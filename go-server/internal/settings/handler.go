package settings

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

type Handler struct {
	svc    *Service
	apiKey string
	model  string
}

func NewHandler(svc *Service, apiKey, model string) *Handler {
	return &Handler{svc: svc, apiKey: apiKey, model: model}
}

func (h *Handler) Get(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	s, err := h.svc.Get(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) Update(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var in Settings
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, err := h.svc.Update(c.Request.Context(), db, &in)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// PreviewVoice connects to Gemini Live with the requested voice, collects one
// turn of PCM audio from a short greeting, and returns it as raw binary.
func (h *Handler) PreviewVoice(c *gin.Context) {
	voice := c.Query("voice")
	if voice == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "voice param required"})
		return
	}

	model := h.model
	if model == "" {
		model = "models/gemini-3.1-flash-live-preview"
	}

	log.Printf("preview-voice: voice=%s model=%s", voice, model)

	pcm, err := collectPreviewAudio(h.apiKey, model, voice)
	if err != nil {
		log.Printf("preview-voice: error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("preview-voice: returning %d PCM bytes", len(pcm))
	c.Header("X-Sample-Rate", "24000")
	c.Data(http.StatusOK, "audio/pcm", pcm)
}

// collectPreviewAudio dials Gemini Live, sends a fixed greeting trigger with
// the given voice, and returns the raw PCM16 bytes from the first turn.
func collectPreviewAudio(apiKey, model, voice string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	u, _ := url.Parse("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent")
	q := u.Query()
	q.Set("key", apiKey)
	u.RawQuery = q.Encode()

	dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}
	conn, resp, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		if resp != nil {
			return nil, fmt.Errorf("dial failed (HTTP %d): %w", resp.StatusCode, err)
		}
		return nil, fmt.Errorf("dial failed: %w", err)
	}
	defer conn.Close()
	log.Printf("preview-voice: connected to Gemini Live")

	// Setup
	setup := map[string]any{
		"setup": map[string]any{
			"model": model,
			"generationConfig": map[string]any{
				"responseModalities": []string{"AUDIO"},
				"speechConfig": map[string]any{
					"voiceConfig": map[string]any{
						"prebuiltVoiceConfig": map[string]any{
							"voiceName": voice,
						},
					},
				},
			},
			"systemInstruction": map[string]any{
				"parts": []map[string]any{
					{"text": "You are a voice assistant preview. Say exactly one natural short greeting sentence, then stop."},
				},
			},
		},
	}
	if err := conn.WriteJSON(setup); err != nil {
		return nil, fmt.Errorf("send setup: %w", err)
	}
	log.Printf("preview-voice: setup sent")

	// Wait for setupComplete
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return nil, fmt.Errorf("waiting for setupComplete: %w", err)
		}
		log.Printf("preview-voice: setup response: %s", string(msg))
		var env map[string]any
		if json.Unmarshal(msg, &env) == nil {
			if _, ok := env["setupComplete"]; ok {
				log.Printf("preview-voice: setup complete")
				break
			}
		}
	}

	// Trigger one turn
	empty := struct{}{}
	for _, m := range []any{
		map[string]any{"realtimeInput": map[string]any{"activityStart": empty}},
		map[string]any{"realtimeInput": map[string]any{"text": "[call connected — say your greeting now]"}},
		map[string]any{"realtimeInput": map[string]any{"activityEnd": empty}},
	} {
		if err := conn.WriteJSON(m); err != nil {
			return nil, err
		}
	}

	// Collect PCM until turnComplete or timeout
	var pcm []byte
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var env map[string]any
		if json.Unmarshal(data, &env) != nil {
			continue
		}
		sc, ok := env["serverContent"].(map[string]any)
		if !ok {
			continue
		}
		if turn, ok := sc["modelTurn"].(map[string]any); ok {
			if parts, ok := turn["parts"].([]any); ok {
				for _, p := range parts {
					part, ok := p.(map[string]any)
					if !ok {
						continue
					}
					inline, ok := part["inlineData"].(map[string]any)
					if !ok {
						continue
					}
					b64, _ := inline["data"].(string)
					audio, err := base64.StdEncoding.DecodeString(b64)
					if err == nil {
						pcm = append(pcm, audio...)
					}
				}
			}
		}
		if done, _ := sc["turnComplete"].(bool); done {
			break
		}
	}

	return pcm, nil
}
