package call

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
	"voiceagent/gemini"
	"voiceagent/internal/calllog"
	"voiceagent/internal/connector"
	"voiceagent/internal/datacollect"
	"voiceagent/internal/knowledge"
)

type Handler struct {
	cfg         CallConfigProvider
	knowledge   *knowledge.Service
	connectors  *connector.Service
	datacollect *datacollect.Service
	calllog     *calllog.Service
	apiKey      string
	model       string
	upgrader    websocket.Upgrader
}

func NewHandler(
	cfg CallConfigProvider,
	knowledge *knowledge.Service,
	connectors *connector.Service,
	datacollect *datacollect.Service,
	calllog *calllog.Service,
	apiKey, model string,
) *Handler {
	return &Handler{
		cfg:         cfg,
		knowledge:   knowledge,
		connectors:  connectors,
		datacollect: datacollect,
		calllog:     calllog,
		apiKey:      apiKey,
		model:       model,
		upgrader: websocket.Upgrader{
			CheckOrigin:     func(r *http.Request) bool { return true },
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
		},
	}
}

func (h *Handler) Handle(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	tenantSlug, _ := c.MustGet("tenant_slug").(string)

	systemPrompt, voice, greeting, language, err := h.cfg.GetForCall(c.Request.Context(), db)
	if err != nil {
		log.Printf("call: get settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load call settings"})
		return
	}

	// Prepend business knowledge to system prompt
	if knowledgeBlock, kErr := h.knowledge.BuildKnowledgeBlock(c.Request.Context(), db); kErr == nil && knowledgeBlock != "" {
		systemPrompt = knowledgeBlock + "\n\n" + systemPrompt
	}

	// Build Gemini tool declarations (convert via JSON round-trip to avoid cross-package type deps)
	var tools []gemini.ToolDeclaration
	if connectorTools, tErr := h.connectors.BuildGeminiTools(c.Request.Context(), db); tErr == nil && len(connectorTools) > 0 {
		tools = append(tools, jsonConvert[[]connector.ToolDeclaration, []gemini.ToolDeclaration](connectorTools)...)
	}
	if collectTool, cErr := h.datacollect.BuildCollectionTool(c.Request.Context(), db); cErr == nil && collectTool != nil {
		tools = append(tools, jsonConvert[datacollect.ToolDeclaration, gemini.ToolDeclaration](*collectTool))
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("call: ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	// Create a preliminary call log so the dispatcher has a valid FK for data collection
	startedAt := time.Now()
	prelimLog := &calllog.CallLog{
		StartedAt: startedAt,
		EndedAt:   startedAt,
		Channel:   "voice",
		Status:    "in_progress",
	}
	if createErr := h.calllog.CreatePrelim(c.Request.Context(), db, prelimLog); createErr != nil {
		log.Printf("call: create prelim log: %v", createErr)
	}

	// Recording hooks — AI chunks carry ms offsets from call start so the WAV
	// writer can place each turn at its correct position in the timeline.
	var (
		mu         sync.Mutex
		userPCM    []byte
		aiChunks   []calllog.TimedChunk
		transcript strings.Builder
	)
	hooks := &gemini.RecordHooks{
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
		OnText: func(text string) { mu.Lock(); transcript.WriteString(text); mu.Unlock() },
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dispatcher := newDispatcher(h.connectors, h.datacollect, prelimLog.ID, "voice", db)

	gemini.Proxy(ctx, conn, h.apiKey, h.model, systemPrompt, voice, greeting, language, tools, dispatcher, hooks)

	// Finalize call log
	endedAt := time.Now()
	mu.Lock()
	t := transcript.String()
	uPCM := append([]byte(nil), userPCM...)
	chunks := append([]calllog.TimedChunk(nil), aiChunks...)
	mu.Unlock()

	if err := h.calllog.FinishCall(c.Request.Context(), db, prelimLog.ID, tenantSlug, startedAt, endedAt, uPCM, chunks, t); err != nil {
		log.Printf("call: finish call log: %v", err)
	}
}

// jsonConvert converts between types that share the same JSON structure.
func jsonConvert[From any, To any](src From) To {
	b, _ := json.Marshal(src)
	var dst To
	_ = json.Unmarshal(b, &dst)
	return dst
}
