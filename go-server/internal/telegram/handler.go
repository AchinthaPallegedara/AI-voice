package telegram

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"voiceagent/internal/tenant"
)

type TenantResolver interface {
	FindByAPIKey(ctx context.Context, key string) (*tenant.Tenant, error)
}

type DBOpener interface {
	GetOrOpen(t *tenant.Tenant) (*gorm.DB, error)
}

type Handler struct {
	svc      *Service
	resolver TenantResolver
	opener   DBOpener
}

func NewHandler(svc *Service, resolver TenantResolver, opener DBOpener) *Handler {
	return &Handler{svc: svc, resolver: resolver, opener: opener}
}

func (h *Handler) GetChannel(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	ch, err := h.svc.Get(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ch)
}

// Setup verifies the bot token, registers the webhook, and saves the channel.
func (h *Handler) Setup(c *gin.Context) {
	var req struct {
		BotToken       string `json:"bot_token"        binding:"required"`
		WebhookBaseURL string `json:"webhook_base_url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	t := c.MustGet("tenant").(*tenant.Tenant)
	db := c.MustGet("db").(*gorm.DB)

	ch, err := h.svc.Setup(c.Request.Context(), db, req.BotToken, req.WebhookBaseURL, t.APIKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ch)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	if err := h.svc.Delete(c.Request.Context(), db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) resolveWebhookContext(c *gin.Context) (*gorm.DB, *Channel, bool) {
	apiKey := c.Param("apiKey")
	t, err := h.resolver.FindByAPIKey(c.Request.Context(), apiKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return nil, nil, false
	}
	db, err := h.opener.GetOrOpen(t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return nil, nil, false
	}
	ch, err := h.svc.Get(c.Request.Context(), db)
	if err != nil || ch == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "telegram channel not configured"})
		return nil, nil, false
	}
	return db, ch, true
}

type tgUpdate struct {
	UpdateID int64 `json:"update_id"`
	Message  *struct {
		MessageID int64 `json:"message_id"`
		Chat      struct {
			ID int64 `json:"id"`
		} `json:"chat"`
		From *struct {
			ID       int64  `json:"id"`
			Username string `json:"username"`
		} `json:"from"`
		Text  string `json:"text"`
		Voice *struct {
			FileID   string `json:"file_id"`
			Duration int    `json:"duration"`
		} `json:"voice"`
	} `json:"message"`
}

func (h *Handler) WebhookReceive(c *gin.Context) {
	_, ch, ok := h.resolveWebhookContext(c)
	if !ok {
		return
	}

	if ch.WebhookSecret != "" && c.GetHeader("X-Telegram-Bot-Api-Secret-Token") != ch.WebhookSecret {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid secret"})
		return
	}

	var update tgUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if update.Message == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	chatID := update.Message.Chat.ID
	chCopy := *ch

	if update.Message.Voice != nil {
		log.Printf("[telegram] voice from chat %d, %ds", chatID, update.Message.Voice.Duration)
		go func() {
			reply := "I received your voice message. Our voice agent will process it shortly."
			if err := h.svc.SendMessage(context.Background(), &chCopy, chatID, reply); err != nil {
				log.Printf("[telegram] send error: %v", err)
			}
		}()
	} else if update.Message.Text != "" {
		log.Printf("[telegram] text from chat %d: %s", chatID, update.Message.Text)
		go func() {
			reply := "Hi! I received your message. Our voice agent will be with you shortly."
			if err := h.svc.SendMessage(context.Background(), &chCopy, chatID, reply); err != nil {
				log.Printf("[telegram] send error: %v", err)
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
