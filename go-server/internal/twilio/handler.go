package twilio

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
	voicegemini "voiceagent/gemini"
	"voiceagent/internal/calllog"
	"voiceagent/internal/connector"
	"voiceagent/internal/datacollect"
	"voiceagent/internal/knowledge"
	"voiceagent/internal/settings"
	"voiceagent/internal/tenant"
)

type TenantResolver interface {
	FindByAPIKey(ctx context.Context, key string) (*tenant.Tenant, error)
}

type DBOpener interface {
	GetOrOpen(t *tenant.Tenant) (*gorm.DB, error)
}

type Handler struct {
	svc         *Service
	resolver    TenantResolver
	opener      DBOpener
	settings    *settings.Service
	knowledge   *knowledge.Service
	connectors  *connector.Service
	datacollect *datacollect.Service
	calllog     *calllog.Service
	geminiKey   string
	geminiModel string
	upgrader    websocket.Upgrader
}

func NewHandler(
	svc *Service,
	resolver TenantResolver,
	opener DBOpener,
	settingsSvc *settings.Service,
	knowledgeSvc *knowledge.Service,
	connectorSvc *connector.Service,
	datacollectSvc *datacollect.Service,
	calllogSvc *calllog.Service,
	geminiKey, geminiModel string,
) *Handler {
	return &Handler{
		svc:         svc,
		resolver:    resolver,
		opener:      opener,
		settings:    settingsSvc,
		knowledge:   knowledgeSvc,
		connectors:  connectorSvc,
		datacollect: datacollectSvc,
		calllog:     calllogSvc,
		geminiKey:   geminiKey,
		geminiModel: geminiModel,
		upgrader: websocket.Upgrader{
			CheckOrigin:     func(r *http.Request) bool { return true },
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
		},
	}
}

// ── CRUD handlers ─────────────────────────────────────────────────────────────

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
	c.Status(http.StatusNoContent)
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

func (h *Handler) resolveWebhookContext(c *gin.Context) (*tenant.Tenant, *gorm.DB, *Channel, bool) {
	apiKey := c.Param("apiKey")
	t, err := h.resolver.FindByAPIKey(c.Request.Context(), apiKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return nil, nil, nil, false
	}
	db, err := h.opener.GetOrOpen(t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return nil, nil, nil, false
	}
	ch, err := h.svc.Get(c.Request.Context(), db)
	if err != nil || ch == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "twilio channel not configured"})
		return nil, nil, nil, false
	}
	return t, db, ch, true
}

// ── Public webhook endpoints ──────────────────────────────────────────────────

// VoiceWebhook is called by Twilio when an inbound call arrives.
// It returns TwiML that connects the call audio to our media-stream WebSocket.
func (h *Handler) VoiceWebhook(c *gin.Context) {
	apiKey := c.Param("apiKey")
	_, _, _, ok := h.resolveWebhookContext(c)
	if !ok {
		return
	}

	host := c.Request.Host
	streamURL := fmt.Sprintf("wss://%s/webhook/%s/twilio/stream", host, apiKey)

	twiml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="%s"/>
  </Connect>
</Response>`, streamURL)

	c.Header("Content-Type", "application/xml")
	c.String(http.StatusOK, twiml)
}

// MediaStream upgrades to WebSocket and runs the Twilio ↔ Gemini Live audio bridge.
func (h *Handler) MediaStream(c *gin.Context) {
	t, db, _, ok := h.resolveWebhookContext(c)
	if !ok {
		return
	}

	systemPrompt, voice, greeting, language, err := h.settings.GetForCall(c.Request.Context(), db)
	if err != nil {
		log.Printf("twilio: get settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load settings"})
		return
	}

	if knowledgeBlock, kErr := h.knowledge.BuildKnowledgeBlock(c.Request.Context(), db); kErr == nil && knowledgeBlock != "" {
		systemPrompt = knowledgeBlock + "\n\n" + systemPrompt
	}

	var tools []voicegemini.ToolDeclaration
	if connectorTools, tErr := h.connectors.BuildGeminiTools(c.Request.Context(), db); tErr == nil && len(connectorTools) > 0 {
		tools = append(tools, twilioJsonConvert[[]connector.ToolDeclaration, []voicegemini.ToolDeclaration](connectorTools)...)
	}
	if collectTool, cErr := h.datacollect.BuildCollectionTool(c.Request.Context(), db); cErr == nil && collectTool != nil {
		tools = append(tools, twilioJsonConvert[datacollect.ToolDeclaration, voicegemini.ToolDeclaration](*collectTool))
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("twilio: ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	startedAt := time.Now()
	prelimLog := &calllog.CallLog{
		StartedAt: startedAt,
		EndedAt:   startedAt,
		Channel:   "twilio",
		Status:    "in_progress",
	}
	if err := h.calllog.CreatePrelim(c.Request.Context(), db, prelimLog); err != nil {
		log.Printf("twilio: create prelim log: %v", err)
	}

	var (
		mu         sync.Mutex
		userPCM    []byte
		aiChunks   []calllog.TimedChunk
		transcript strings.Builder
	)
	hooks := &BridgeHooks{
		OnUserAudio: func(pcm []byte) {
			mu.Lock()
			userPCM = append(userPCM, pcm...)
			mu.Unlock()
		},
		OnAIAudio: func(pcm []byte) {
			offsetMs := time.Since(startedAt).Milliseconds()
			mu.Lock()
			aiChunks = append(aiChunks, calllog.TimedChunk{Data: pcm, OffsetMs: offsetMs})
			mu.Unlock()
		},
		OnText: func(text string) {
			mu.Lock()
			transcript.WriteString(text)
			mu.Unlock()
		},
	}

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	dispatcher := &twilioDispatcher{
		connectors:  h.connectors,
		datacollect: h.datacollect,
		callLogID:   prelimLog.ID,
		channel:     "twilio",
		db:          db,
	}

	Bridge(ctx, conn, h.geminiKey, h.geminiModel, systemPrompt, voice, greeting, language, tools, dispatcher, hooks)

	endedAt := time.Now()
	mu.Lock()
	tr := transcript.String()
	uPCM := append([]byte(nil), userPCM...)
	chunks := append([]calllog.TimedChunk(nil), aiChunks...)
	mu.Unlock()

	if err := h.calllog.FinishCall(c.Request.Context(), db, prelimLog.ID, t.Slug, startedAt, endedAt, uPCM, chunks, tr); err != nil {
		log.Printf("twilio: finish call log: %v", err)
	}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type twilioDispatcher struct {
	connectors  *connector.Service
	datacollect *datacollect.Service
	callLogID   uint
	channel     string
	db          *gorm.DB
}

func (d *twilioDispatcher) Dispatch(ctx context.Context, name string, args map[string]any) (string, error) {
	if name == "collect_data" {
		return d.datacollect.HandleFunctionCall(ctx, d.db, d.callLogID, d.channel, args)
	}
	return d.connectors.DispatchByName(ctx, name, args, d.db)
}

func twilioJsonConvert[From any, To any](src From) To {
	b, _ := json.Marshal(src)
	var dst To
	_ = json.Unmarshal(b, &dst)
	return dst
}
