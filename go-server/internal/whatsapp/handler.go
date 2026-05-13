package whatsapp

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
	svc           *Service
	resolver      TenantResolver
	opener        DBOpener
	metaAppID     string
	metaAppSecret string
}

func NewHandler(svc *Service, resolver TenantResolver, opener DBOpener, metaAppID, metaAppSecret string) *Handler {
	return &Handler{
		svc:           svc,
		resolver:      resolver,
		opener:        opener,
		metaAppID:     metaAppID,
		metaAppSecret: metaAppSecret,
	}
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

func (h *Handler) SaveChannel(c *gin.Context) {
	var ch Channel
	if err := c.ShouldBindJSON(&ch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	saved, err := h.svc.Save(c.Request.Context(), db, &ch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, saved)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	if err := h.svc.Delete(c.Request.Context(), db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// OAuthURL returns the Meta OAuth dialog URL the frontend should open in a popup.
func (h *Handler) OAuthURL(c *gin.Context) {
	if h.metaAppID == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "META_APP_ID not configured"})
		return
	}
	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "redirect_uri required"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": h.svc.OAuthURL(h.metaAppID, redirectURI)})
}

// OAuthExchange exchanges the authorization code for an access token and
// returns the list of WhatsApp phone numbers for the user to pick from.
func (h *Handler) OAuthExchange(c *gin.Context) {
	if h.metaAppID == "" || h.metaAppSecret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Meta credentials not configured"})
		return
	}
	var req struct {
		Code        string `json:"code" binding:"required"`
		RedirectURI string `json:"redirect_uri" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token, phones, err := h.svc.OAuthExchange(
		c.Request.Context(), req.Code, req.RedirectURI, h.metaAppID, h.metaAppSecret,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": token, "phone_numbers": phones})
}

// resolveWebhookContext looks up the tenant from the URL :apiKey param.
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
		c.JSON(http.StatusNotFound, gin.H{"error": "whatsapp channel not configured"})
		return nil, nil, false
	}
	return db, ch, true
}

// WebhookVerify handles Meta's webhook verification challenge.
func (h *Handler) WebhookVerify(c *gin.Context) {
	_, ch, ok := h.resolveWebhookContext(c)
	if !ok {
		return
	}
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token == ch.VerifyToken {
		c.String(http.StatusOK, challenge)
		return
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "verification failed"})
}

type waPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		Changes []struct {
			Value struct {
				Messages []struct {
					From string `json:"from"`
					Type string `json:"type"`
					Text struct {
						Body string `json:"body"`
					} `json:"text"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

// WebhookReceive handles incoming WhatsApp messages from Meta.
func (h *Handler) WebhookReceive(c *gin.Context) {
	_, ch, ok := h.resolveWebhookContext(c)
	if !ok {
		return
	}

	var payload waPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			for _, msg := range change.Value.Messages {
				if msg.Type == "text" && msg.Text.Body != "" {
					log.Printf("[whatsapp] message from %s: %s", msg.From, msg.Text.Body)
					chCopy := *ch
					from := msg.From
					go func() {
						reply := "Hi! I received your message. Our voice agent will be with you shortly."
						if err := h.svc.SendTextMessage(context.Background(), &chCopy, from, reply); err != nil {
							log.Printf("[whatsapp] send error: %v", err)
						}
					}()
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
