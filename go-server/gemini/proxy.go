package gemini

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ── function calling types ────────────────────────────────────────────────────

// ToolDeclaration is sent to Gemini during setup to declare available tools.
type ToolDeclaration struct {
	FunctionDeclarations []FunctionDecl `json:"functionDeclarations"`
}

// FunctionDecl describes a single callable function using JSON Schema for params.
type FunctionDecl struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// FunctionDispatcher is called by Proxy to handle Gemini function call requests.
type FunctionDispatcher interface {
	Dispatch(ctx context.Context, name string, args map[string]any) (string, error)
}

const (
	liveEndpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
	defaultModel = "models/gemini-3.1-flash-live-preview"
	inputMIME    = "audio/pcm;rate=16000"
)

// ── setup (client → Gemini) ──────────────────────────────────────────────────

type setupEnvelope struct {
	Setup setupCfg `json:"setup"`
}
type setupCfg struct {
	Model             string            `json:"model"`
	GenerationConfig  genCfg            `json:"generationConfig"`
	SystemInstruction *sysInstr         `json:"systemInstruction,omitempty"`
	Tools             []ToolDeclaration `json:"tools,omitempty"`
}
type genCfg struct {
	ResponseModalities []string  `json:"responseModalities"`
	SpeechConfig       speechCfg `json:"speechConfig"`
}
type speechCfg struct {
	VoiceConfig voiceCfg `json:"voiceConfig"`
}
type voiceCfg struct {
	PrebuiltVoiceConfig prebuiltVoice `json:"prebuiltVoiceConfig"`
}
type prebuiltVoice struct {
	VoiceName string `json:"voiceName"`
}
type sysInstr struct {
	Parts []textPart `json:"parts"`
}
type textPart struct {
	Text string `json:"text"`
}

// ── audio input (client → Gemini) ────────────────────────────────────────────

type realtimeEnvelope struct {
	RealtimeInput realtimeInput `json:"realtimeInput"`
}
type realtimeInput struct {
	Audio         *audioChunk  `json:"audio,omitempty"`
	Text          string       `json:"text,omitempty"`
	ActivityStart *struct{}    `json:"activityStart,omitempty"`
	ActivityEnd   *struct{}    `json:"activityEnd,omitempty"`
}
type audioChunk struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

// ── server responses (Gemini → client) ──────────────────────────────────────

type serverEnvelope struct {
	SetupComplete *json.RawMessage `json:"setupComplete,omitempty"`
	ServerContent *serverContent   `json:"serverContent,omitempty"`
	ToolCall      *toolCall        `json:"toolCall,omitempty"`
}

// toolCall carries function call requests from Gemini.
type toolCall struct {
	FunctionCalls []functionCall `json:"functionCalls"`
}
type functionCall struct {
	ID   string          `json:"id"`
	Name string          `json:"name"`
	Args json.RawMessage `json:"args"`
}

// ── function response (client → Gemini) ─────────────────────────────────────

type functionResponseEnvelope struct {
	ToolResponse toolResponse `json:"toolResponse"`
}
type toolResponse struct {
	FunctionResponses []functionResponse `json:"functionResponses"`
}
type functionResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Response any    `json:"response"`
}
type serverContent struct {
	ModelTurn    *modelTurn `json:"modelTurn,omitempty"`
	TurnComplete bool       `json:"turnComplete,omitempty"`
	Interrupted  bool       `json:"interrupted,omitempty"`
}
type modelTurn struct {
	Parts []responsePart `json:"parts"`
}
type responsePart struct {
	InlineData *inlineData `json:"inlineData,omitempty"`
	Text       string      `json:"text,omitempty"`
}
type inlineData struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

// ── Proxy ────────────────────────────────────────────────────────────────────

// RecordHooks are optional callbacks injected into Proxy for call recording.
// Each hook is called inline on the goroutine that reads the respective side;
// implementations must be goroutine-safe.
type RecordHooks struct {
	OnUserAudio func(pcm []byte) // raw PCM16 from browser (16 kHz)
	OnAIAudio   func(pcm []byte) // raw PCM16 from Gemini (24 kHz)
	OnText      func(text string)
}

// Proxy bridges one browser WebSocket to Gemini Live. Blocks until either
// side disconnects.
func Proxy(ctx context.Context, browser *websocket.Conn, apiKey, model, systemPrompt, voice, greeting string, tools []ToolDeclaration, dispatcher FunctionDispatcher, hooks *RecordHooks) {
	if apiKey == "" {
		writeJSON(browser, nil, map[string]string{"type": "error", "text": "GEMINI_API_KEY not configured on server"})
		browser.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		return
	}
	if voice == "" {
		voice = "Puck"
	}
	if model == "" {
		model = defaultModel
	}

	// ── connect to Gemini Live ────────────────────────────────────────────
	u, _ := url.Parse(liveEndpoint)
	q := u.Query()
	q.Set("key", apiKey)
	u.RawQuery = q.Encode()

	dialer := websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
		Proxy:            http.ProxyFromEnvironment,
	}
	gConn, _, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		log.Printf("gemini: dial: %v", err)
		writeJSON(browser, nil, map[string]string{"type": "error", "text": "Could not reach Gemini Live: " + err.Error()})
		browser.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		return
	}
	defer gConn.Close()

	// ── send setup ────────────────────────────────────────────────────────
	empty := struct{}{}
	setup := setupEnvelope{
		Setup: setupCfg{
			Model: model,
			GenerationConfig: genCfg{
				ResponseModalities: []string{"AUDIO"},
				SpeechConfig:       speechCfg{VoiceConfig: voiceCfg{PrebuiltVoiceConfig: prebuiltVoice{VoiceName: voice}}},
			},
			Tools: tools,
		},
	}
	if systemPrompt != "" {
		setup.Setup.SystemInstruction = &sysInstr{Parts: []textPart{{Text: systemPrompt}}}
	}
	if err := gConn.WriteJSON(setup); err != nil {
		log.Printf("gemini: setup send: %v", err)
		return
	}

	// ── wait for setupComplete ────────────────────────────────────────────
	for {
		_, msg, err := gConn.ReadMessage()
		if err != nil {
			log.Printf("gemini: waiting setup_complete: %v", err)
			return
		}
		var env serverEnvelope
		if json.Unmarshal(msg, &env) == nil && env.SetupComplete != nil {
			break
		}
	}

	// ── trigger greeting if configured ───────────────────────────────────
	if strings.TrimSpace(greeting) != "" {
		// signal start → send "Hello" text → signal end so Gemini generates audio
		msgs := []any{
			realtimeEnvelope{RealtimeInput: realtimeInput{ActivityStart: &empty}},
			realtimeEnvelope{RealtimeInput: realtimeInput{Text: "Hello"}},
			realtimeEnvelope{RealtimeInput: realtimeInput{ActivityEnd: &empty}},
		}
		for _, m := range msgs {
			if err := gConn.WriteJSON(m); err != nil {
				log.Printf("gemini: greeting send: %v", err)
			}
		}
	}

	// ── notify browser ────────────────────────────────────────────────────
	var browserMu sync.Mutex
	writeJSON(browser, &browserMu, map[string]string{"type": "status", "status": "ready"})

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var once sync.Once
	closeAll := func() {
		once.Do(func() {
			cancel()
			gConn.Close()
		})
	}
	defer closeAll()

	errCh := make(chan error, 2)

	// goroutine: browser → Gemini (audio forwarding)
	go func() {
		log.Printf("gemini proxy: browser→gemini goroutine started")
		defer closeAll()
		for {
			mt, data, err := browser.ReadMessage()
			if err != nil {
				log.Printf("gemini proxy: browser read error: %v", err)
				errCh <- err
				return
			}
			if mt != websocket.BinaryMessage || len(data) == 0 {
				continue
			}
			if hooks != nil && hooks.OnUserAudio != nil {
				cp := make([]byte, len(data))
				copy(cp, data)
				hooks.OnUserAudio(cp)
			}
			msg := realtimeEnvelope{
				RealtimeInput: realtimeInput{
					Audio: &audioChunk{
						Data:     base64.StdEncoding.EncodeToString(data),
						MimeType: inputMIME,
					},
				},
			}
			if err := gConn.WriteJSON(msg); err != nil {
				log.Printf("gemini proxy: gemini write error: %v", err)
				errCh <- err
				return
			}
		}
	}()

	// goroutine: Gemini → browser (audio + events + function calls)
	go func() {
		log.Printf("gemini proxy: gemini→browser goroutine started")
		defer closeAll()
		for {
			_, data, err := gConn.ReadMessage()
			if err != nil {
				log.Printf("gemini proxy: gemini read error: %v", err)
				errCh <- err
				return
			}

			var env serverEnvelope
			if err := json.Unmarshal(data, &env); err != nil {
				continue
			}

			// Handle function calls — execute and send responses back to Gemini
			if env.ToolCall != nil && dispatcher != nil && len(env.ToolCall.FunctionCalls) > 0 {
				var responses []functionResponse
				for _, fc := range env.ToolCall.FunctionCalls {
					var args map[string]any
					if len(fc.Args) > 0 {
						_ = json.Unmarshal(fc.Args, &args)
					}
					result, dispErr := dispatcher.Dispatch(ctx, fc.Name, args)
					if dispErr != nil {
						log.Printf("gemini proxy: dispatch %s: %v", fc.Name, dispErr)
						result = "Error: " + dispErr.Error()
					}
					responses = append(responses, functionResponse{
						ID:       fc.ID,
						Name:     fc.Name,
						Response: map[string]string{"output": result},
					})
				}
				resp := functionResponseEnvelope{
					ToolResponse: toolResponse{FunctionResponses: responses},
				}
				if err := gConn.WriteJSON(resp); err != nil {
					log.Printf("gemini proxy: function response send: %v", err)
				}
				continue
			}

			if env.ServerContent == nil {
				continue
			}
			sc := env.ServerContent

			if sc.Interrupted {
				writeJSON(browser, &browserMu, map[string]string{"type": "interrupted"})
				continue
			}

			if sc.ModelTurn != nil {
				for _, p := range sc.ModelTurn.Parts {
					if p.InlineData != nil && p.InlineData.Data != "" {
						audio, err := base64.StdEncoding.DecodeString(p.InlineData.Data)
						if err == nil {
							if hooks != nil && hooks.OnAIAudio != nil {
								cp := make([]byte, len(audio))
								copy(cp, audio)
								hooks.OnAIAudio(cp)
							}
							browserMu.Lock()
							browser.WriteMessage(websocket.BinaryMessage, audio)
							browserMu.Unlock()
						}
					}
					if p.Text != "" {
						if hooks != nil && hooks.OnText != nil {
							hooks.OnText(p.Text)
						}
						writeJSON(browser, &browserMu, map[string]any{"type": "text", "text": p.Text})
					}
				}
			}

			if sc.TurnComplete {
				writeJSON(browser, &browserMu, map[string]string{"type": "turn_complete"})
			}
		}
	}()

	// Block until one side disconnects; both goroutines log their own errors.
	select {
	case <-ctx.Done():
		log.Printf("gemini proxy: context cancelled")
	case <-errCh:
	}
}

func writeJSON(conn *websocket.Conn, mu *sync.Mutex, v any) {
	if mu != nil {
		mu.Lock()
		defer mu.Unlock()
	}
	conn.WriteJSON(v)
}
