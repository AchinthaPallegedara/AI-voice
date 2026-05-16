package twilio

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	voicegemini "voiceagent/gemini"
)

// ── Gemini Live protocol types (mirrored privately for the bridge) ─────────────

type geminiSetup struct {
	Setup geminiSetupCfg `json:"setup"`
}
type geminiSetupCfg struct {
	Model             string                       `json:"model"`
	GenerationConfig  geminiGenCfg                 `json:"generationConfig"`
	SystemInstruction *geminiSysInstr              `json:"systemInstruction,omitempty"`
	Tools             []voicegemini.ToolDeclaration `json:"tools,omitempty"`
}
type geminiGenCfg struct {
	ResponseModalities []string        `json:"responseModalities"`
	SpeechConfig       geminiSpeechCfg `json:"speechConfig"`
}
type geminiSpeechCfg struct {
	VoiceConfig  geminiVoiceCfg `json:"voiceConfig"`
	LanguageCode string         `json:"languageCode,omitempty"`
}
type geminiVoiceCfg struct {
	PrebuiltVoiceConfig geminiPrebuiltVoice `json:"prebuiltVoiceConfig"`
}
type geminiPrebuiltVoice struct {
	VoiceName string `json:"voiceName"`
}
type geminiSysInstr struct {
	Parts []geminiTextPart `json:"parts"`
}
type geminiTextPart struct {
	Text string `json:"text"`
}
type geminiRealtimeEnv struct {
	RealtimeInput geminiRealtimeInput `json:"realtimeInput"`
}
type geminiRealtimeInput struct {
	Audio         *geminiAudioChunk `json:"audio,omitempty"`
	Text          string            `json:"text,omitempty"`
	ActivityStart *struct{}         `json:"activityStart,omitempty"`
	ActivityEnd   *struct{}         `json:"activityEnd,omitempty"`
}
type geminiAudioChunk struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}
type geminiServerEnv struct {
	SetupComplete *json.RawMessage    `json:"setupComplete,omitempty"`
	ServerContent *geminiServerContent `json:"serverContent,omitempty"`
	ToolCall      *geminiToolCall     `json:"toolCall,omitempty"`
}
type geminiServerContent struct {
	ModelTurn    *geminiModelTurn `json:"modelTurn,omitempty"`
	TurnComplete bool             `json:"turnComplete,omitempty"`
	Interrupted  bool             `json:"interrupted,omitempty"`
}
type geminiModelTurn struct {
	Parts []geminiResponsePart `json:"parts"`
}
type geminiResponsePart struct {
	InlineData *geminiInlineData `json:"inlineData,omitempty"`
	Text       string            `json:"text,omitempty"`
}
type geminiInlineData struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}
type geminiToolCall struct {
	FunctionCalls []geminiFunctionCall `json:"functionCalls"`
}
type geminiFunctionCall struct {
	ID   string          `json:"id"`
	Name string          `json:"name"`
	Args json.RawMessage `json:"args"`
}
type geminiFuncRespEnv struct {
	ToolResponse geminiFuncToolResp `json:"toolResponse"`
}
type geminiFuncToolResp struct {
	FunctionResponses []geminiFuncResp `json:"functionResponses"`
}
type geminiFuncResp struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Response any    `json:"response"`
}

// ── Twilio Media Stream protocol types ────────────────────────────────────────

type twilioMsg struct {
	Event          string       `json:"event"`
	SequenceNumber string       `json:"sequenceNumber,omitempty"`
	StreamSid      string       `json:"streamSid,omitempty"`
	Start          *twilioStart `json:"start,omitempty"`
	Media          *twilioMedia `json:"media,omitempty"`
}
type twilioStart struct {
	StreamSid  string `json:"streamSid"`
	AccountSid string `json:"accountSid"`
	CallSid    string `json:"callSid"`
}
type twilioMedia struct {
	Track     string `json:"track"`
	Chunk     string `json:"chunk"`
	Timestamp string `json:"timestamp"`
	Payload   string `json:"payload"` // base64 µ-law 8 kHz
}

const (
	geminiLiveEndpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
	geminiInputMIME    = "audio/pcm;rate=16000"
	geminiDefaultModel = "models/gemini-2.0-flash-live-001"
)

// BridgeHooks are optional callbacks for recording and transcription.
type BridgeHooks struct {
	OnUserAudio func(pcm []byte) // PCM16 LE 16 kHz from Twilio caller
	OnAIAudio   func(pcm []byte) // PCM16 LE 24 kHz from Gemini
	OnText      func(string)
}

// Bridge connects one Twilio Media Stream WebSocket to Gemini Live.
// Blocks until the call ends (Twilio "stop" event or either side disconnects).
func Bridge(
	ctx context.Context,
	twilioConn *websocket.Conn,
	geminiAPIKey, geminiModel,
	systemPrompt, voice, greeting, language string,
	tools []voicegemini.ToolDeclaration,
	dispatcher voicegemini.FunctionDispatcher,
	hooks *BridgeHooks,
) {
	if voice == "" {
		voice = "Puck"
	}
	if geminiModel == "" {
		geminiModel = geminiDefaultModel
	}

	// ── Connect to Gemini Live ────────────────────────────────────────────────
	u, _ := url.Parse(geminiLiveEndpoint)
	q := u.Query()
	q.Set("key", geminiAPIKey)
	u.RawQuery = q.Encode()

	gConn, _, err := (&websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
		Proxy:            http.ProxyFromEnvironment,
	}).DialContext(ctx, u.String(), nil)
	if err != nil {
		log.Printf("twilio bridge: gemini dial: %v", err)
		return
	}
	defer gConn.Close()

	// ── Send Gemini setup ─────────────────────────────────────────────────────
	setup := geminiSetup{Setup: geminiSetupCfg{
		Model: geminiModel,
		GenerationConfig: geminiGenCfg{
			ResponseModalities: []string{"AUDIO"},
			SpeechConfig: geminiSpeechCfg{
				VoiceConfig:  geminiVoiceCfg{PrebuiltVoiceConfig: geminiPrebuiltVoice{VoiceName: voice}},
				LanguageCode: bcp47(language),
			},
		},
		Tools: tools,
	}}
	if systemPrompt != "" {
		setup.Setup.SystemInstruction = &geminiSysInstr{Parts: []geminiTextPart{{Text: systemPrompt}}}
	}
	if err := gConn.WriteJSON(setup); err != nil {
		log.Printf("twilio bridge: gemini setup send: %v", err)
		return
	}

	// ── Wait for setupComplete ────────────────────────────────────────────────
	for {
		_, msg, err := gConn.ReadMessage()
		if err != nil {
			log.Printf("twilio bridge: gemini setup_complete wait: %v", err)
			return
		}
		var env geminiServerEnv
		if json.Unmarshal(msg, &env) == nil && env.SetupComplete != nil {
			break
		}
	}

	// ── Wait for Twilio "start" to obtain streamSid ───────────────────────────
	var streamSid string
	for streamSid == "" {
		_, data, err := twilioConn.ReadMessage()
		if err != nil {
			log.Printf("twilio bridge: waiting start event: %v", err)
			return
		}
		var msg twilioMsg
		if json.Unmarshal(data, &msg) == nil && msg.Event == "start" && msg.Start != nil {
			streamSid = msg.Start.StreamSid
		}
	}

	// ── Send greeting cue to Gemini ───────────────────────────────────────────
	empty := struct{}{}
	for _, m := range []any{
		geminiRealtimeEnv{RealtimeInput: geminiRealtimeInput{ActivityStart: &empty}},
		geminiRealtimeEnv{RealtimeInput: geminiRealtimeInput{Text: "[call connected — open with your greeting now]"}},
		geminiRealtimeEnv{RealtimeInput: geminiRealtimeInput{ActivityEnd: &empty}},
	} {
		if err := gConn.WriteJSON(m); err != nil {
			log.Printf("twilio bridge: greeting send: %v", err)
		}
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var gMu, twMu sync.Mutex
	var once sync.Once
	closeAll := func() {
		once.Do(func() { cancel(); gConn.Close(); twilioConn.Close() })
	}
	defer closeAll()

	errCh := make(chan error, 2)

	// ── Twilio → Gemini (audio forwarding) ───────────────────────────────────
	go func() {
		defer closeAll()
		for {
			_, data, err := twilioConn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			var msg twilioMsg
			if json.Unmarshal(data, &msg) != nil {
				continue
			}
			if msg.Event == "stop" {
				errCh <- nil
				return
			}
			if msg.Event != "media" || msg.Media == nil || msg.Media.Payload == "" {
				continue
			}
			mulaw, err := base64.StdEncoding.DecodeString(msg.Media.Payload)
			if err != nil {
				continue
			}
			pcm := MulawToGeminiPCM(mulaw)
			if hooks != nil && hooks.OnUserAudio != nil {
				cp := make([]byte, len(pcm))
				copy(cp, pcm)
				hooks.OnUserAudio(cp)
			}
			audioMsg := geminiRealtimeEnv{RealtimeInput: geminiRealtimeInput{
				Audio: &geminiAudioChunk{
					Data:     base64.StdEncoding.EncodeToString(pcm),
					MimeType: geminiInputMIME,
				},
			}}
			gMu.Lock()
			gConn.WriteJSON(audioMsg)
			gMu.Unlock()
		}
	}()

	// ── Gemini → Twilio (audio + function calls) ──────────────────────────────
	go func() {
		defer closeAll()
		for {
			_, data, err := gConn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			var env geminiServerEnv
			if json.Unmarshal(data, &env) != nil {
				continue
			}

			// Function calls
			if env.ToolCall != nil && dispatcher != nil && len(env.ToolCall.FunctionCalls) > 0 {
				var resps []geminiFuncResp
				for _, fc := range env.ToolCall.FunctionCalls {
					var args map[string]any
					_ = json.Unmarshal(fc.Args, &args)
					result, dispErr := dispatcher.Dispatch(ctx, fc.Name, args)
					if dispErr != nil {
						result = "Error: " + dispErr.Error()
					}
					resps = append(resps, geminiFuncResp{ID: fc.ID, Name: fc.Name, Response: map[string]string{"output": result}})
				}
				gMu.Lock()
				gConn.WriteJSON(geminiFuncRespEnv{ToolResponse: geminiFuncToolResp{FunctionResponses: resps}})
				gMu.Unlock()
				continue
			}

			sc := env.ServerContent
			if sc == nil {
				continue
			}

			if sc.Interrupted {
				// Clear Twilio's playout buffer on barge-in
				twMu.Lock()
				twilioConn.WriteJSON(map[string]string{"event": "clear", "streamSid": streamSid})
				twMu.Unlock()
				continue
			}

			if sc.ModelTurn != nil {
				for _, p := range sc.ModelTurn.Parts {
					if p.InlineData != nil && p.InlineData.Data != "" {
						pcm, err := base64.StdEncoding.DecodeString(p.InlineData.Data)
						if err != nil {
							continue
						}
						if hooks != nil && hooks.OnAIAudio != nil {
							cp := make([]byte, len(pcm))
							copy(cp, pcm)
							hooks.OnAIAudio(cp)
						}
						mulaw := GeminiPCMToMulaw(pcm)
						twMu.Lock()
						twilioConn.WriteJSON(map[string]any{
							"event":     "media",
							"streamSid": streamSid,
							"media":     map[string]string{"payload": base64.StdEncoding.EncodeToString(mulaw)},
						})
						twMu.Unlock()
					}
					if p.Text != "" && hooks != nil && hooks.OnText != nil {
						hooks.OnText(p.Text)
					}
				}
			}
		}
	}()

	select {
	case <-ctx.Done():
	case <-errCh:
	}
}

func bcp47(code string) string {
	m := map[string]string{
		"en": "en-US", "si": "si-LK", "es": "es-ES",
		"fr": "fr-FR", "de": "de-DE", "pt": "pt-PT",
		"ja": "ja-JP", "zh": "zh-CN", "ar": "ar-SA",
		"hi": "hi-IN", "ko": "ko-KR", "it": "it-IT",
	}
	if tag, ok := m[code]; ok {
		return tag
	}
	return ""
}
