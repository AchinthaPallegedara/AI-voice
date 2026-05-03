package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"

	"voice-agent/go-server/audio"
	"voice-agent/go-server/metrics"
	"voice-agent/go-server/pipeline"
	"voice-agent/go-server/session"
	"voice-agent/go-server/store"
)

const (
	interruptRMSThreshold      = 0.008
	interruptConsecutiveFrames = 2
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// WebRTCEngine wires together Pion WebRTC with the STT/LLM/TTS pipeline.
type WebRTCEngine struct {
	webrtcConfig webrtc.Configuration
	mgr          *session.Manager
	sttClient    *pipeline.STTClient
	ttsClient    *pipeline.TTSClient
	llmClient    *pipeline.LLMClient
	filler       *pipeline.FillerPlayer
	convStore    store.ConversationStore
	opusPool     *OpusPool
}

func NewWebRTCEngine(
	mgr *session.Manager,
	stt *pipeline.STTClient,
	tts *pipeline.TTSClient,
	llm *pipeline.LLMClient,
	filler *pipeline.FillerPlayer,
	cs store.ConversationStore,
	opusPool *OpusPool,
) *WebRTCEngine {
	turnURL := os.Getenv("TURN_SERVER")
	turnUser := os.Getenv("TURN_USER")
	turnPass := os.Getenv("TURN_PASS")

	iceServers := []webrtc.ICEServer{
		{URLs: []string{"stun:stun.l.google.com:19302"}},
	}
	if turnURL != "" {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs:       []string{turnURL},
			Username:   turnUser,
			Credential: turnPass,
		})
	}

	return &WebRTCEngine{
		webrtcConfig: webrtc.Configuration{ICEServers: iceServers},
		mgr:          mgr,
		sttClient:    stt,
		ttsClient:    tts,
		llmClient:    llm,
		filler:       filler,
		convStore:    cs,
		opusPool:     opusPool,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Event helpers
// ─────────────────────────────────────────────────────────────────────────────

func sendEvent(sess *session.Session, v any) {
	if sess.SendEvent == nil {
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	sess.SendEvent(string(b))
}

type statusEvent struct {
	Type   string `json:"type"`
	Status string `json:"status"`
}

type transcriptEvent struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	IsFinal bool   `json:"is_final"`
}

type replyEvent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type errorEvent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP handlers
// ─────────────────────────────────────────────────────────────────────────────

type offerRequest struct {
	SDP       string `json:"sdp"`
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
}

type answerResponse struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"`
}

// HandleOffer handles POST /signal.
func (e *WebRTCEngine) HandleOffer(w http.ResponseWriter, r *http.Request) {
	var req offerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Type != "offer" {
		http.Error(w, "expected offer", http.StatusBadRequest)
		return
	}

	ip := r.RemoteAddr
	sess, err := e.mgr.Create(req.SessionID, ip)
	if err != nil {
		http.Error(w, err.Error(), http.StatusTooManyRequests)
		return
	}
	metrics.ActiveSessions.Inc()

	queue := audio.NewQueue()
	sess.AudioQueue = queue

	pc, err := webrtc.NewPeerConnection(e.webrtcConfig)
	if err != nil {
		e.mgr.Delete(req.SessionID)
		http.Error(w, "peer connection failed", http.StatusInternalServerError)
		return
	}

	// DataChannel "events": Go → browser (transcripts, status, reply, error).
	// Created by Go so the browser receives it via pc.ondatachannel.
	dc, err := pc.CreateDataChannel("events", nil)
	if err != nil {
		pc.Close()          //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "data channel failed", http.StatusInternalServerError)
		return
	}
	dc.OnOpen(func() {
		sess.SendEvent = func(msg string) {
			if err := dc.SendText(msg); err != nil {
				log.Printf("[%s] DC send: %v", sess.ID, err)
			}
		}
	})
	dc.OnClose(func() { sess.SendEvent = nil })

	// DataChannel messages: browser → Go (reset command)
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		var m map[string]string
		if err := json.Unmarshal(msg.Data, &m); err != nil {
			return
		}
		if m["type"] == "reset" {
			e.convStore.Clear(sess.ID) //nolint:errcheck
		}
	})

	// Outbound audio track (TTS → browser)
	outTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio", "voice-agent",
	)
	if err != nil {
		pc.Close() //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "track failed", http.StatusInternalServerError)
		return
	}
	if _, err = pc.AddTrack(outTrack); err != nil {
		pc.Close() //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "add track failed", http.StatusInternalServerError)
		return
	}

	// Session context — cancelled when PC closes or session is deleted.
	sessCtx, sessCancel := context.WithCancel(r.Context())

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("[%s] WebRTC state: %s", sess.ID, s)
		if s == webrtc.PeerConnectionStateFailed ||
			s == webrtc.PeerConnectionStateDisconnected ||
			s == webrtc.PeerConnectionStateClosed {
			sessCancel()
			e.mgr.Delete(req.SessionID)
			metrics.ActiveSessions.Dec()
		}
	})

	// Inbound audio track (browser microphone)
	pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		if track.Kind() != webrtc.RTPCodecTypeAudio {
			return
		}
		go e.runInbound(sessCtx, track, sess, queue, outTrack)
	})

	// SDP offer/answer
	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: req.SDP}
	if err := pc.SetRemoteDescription(offer); err != nil {
		sessCancel()
		pc.Close() //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "set remote desc: "+err.Error(), http.StatusBadRequest)
		return
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		sessCancel()
		pc.Close() //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "create answer: "+err.Error(), http.StatusInternalServerError)
		return
	}
	gatherDone := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		sessCancel()
		pc.Close() //nolint:errcheck
		e.mgr.Delete(req.SessionID)
		http.Error(w, "set local desc: "+err.Error(), http.StatusInternalServerError)
		return
	}
	<-gatherDone

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answerResponse{ //nolint:errcheck
		SDP:  pc.LocalDescription().SDP,
		Type: "answer",
	})
}

// HandleICE handles WS /ice (placeholder for future trickle ICE).
func (e *WebRTCEngine) HandleICE(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio pipeline
// ─────────────────────────────────────────────────────────────────────────────

func (e *WebRTCEngine) runInbound(
	ctx context.Context,
	track *webrtc.TrackRemote,
	sess *session.Session,
	queue *audio.Queue,
	outTrack *webrtc.TrackLocalStaticSample,
) {
	jitter := pipeline.NewJitterBuffer(8)
	audioOut := jitter.Out()

	go e.runOutbound(ctx, queue, outTrack)

	// Decode Opus RTP → PCM16 → jitter buffer; detect interrupt while speaking.
	go func() {
		energyCount := 0
		for {
			pkt, _, err := track.ReadRTP()
			if err != nil {
				if ctx.Err() == nil && err != io.EOF {
					log.Printf("[%s] RTP read: %v", sess.ID, err)
				}
				return
			}
			sess.OnActivity()

			pcm, err := e.opusPool.Decode(pkt.Payload)
			if err != nil {
				continue
			}

			if sess.State() == session.StateSpeaking {
				if rmsInt16(pcm) > interruptRMSThreshold {
					energyCount++
					if energyCount >= interruptConsecutiveFrames {
						energyCount = 0
						sess.Interrupt()
						jitter.Reset()
						sendEvent(sess, statusEvent{Type: "status", Status: "idle"})
					}
				} else {
					energyCount = 0
				}
			}
			jitter.Push(pcm)
		}
	}()

	for ctx.Err() == nil {
		if err := e.runUtterance(ctx, sess, audioOut, queue); err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[%s] utterance error: %v", sess.ID, err)
			sendEvent(sess, errorEvent{Type: "error", Text: "pipeline error"})
		}
	}
}

// runUtterance runs the full pipeline for one user utterance.
func (e *WebRTCEngine) runUtterance(
	ctx context.Context,
	sess *session.Session,
	audioOut <-chan []byte,
	queue *audio.Queue,
) error {
	utterCtx, utterCancel := context.WithCancel(ctx)
	defer utterCancel()

	sess.SetState(session.StateListening)
	speechStart := time.Now()

	// Bounded STT input channel
	sttIn := make(chan []byte, 8)
	go func() {
		defer close(sttIn)
		for {
			select {
			case chunk, ok := <-audioOut:
				if !ok {
					return
				}
				select {
				case sttIn <- chunk:
				case <-utterCtx.Done():
					return
				}
			case <-utterCtx.Done():
				return
			}
		}
	}()

	transcripts, err := e.sttClient.Stream(utterCtx, sttIn, sess.ID, speechStart)
	if err != nil {
		return fmt.Errorf("stt stream: %w", err)
	}

	var committedText string
	var lastText string
	var stableSince time.Time

	for chunk := range transcripts {
		if chunk.Text != lastText {
			lastText = chunk.Text
			stableSince = time.Now()
			// Send partial transcript for UI feedback
			if chunk.Text != "" {
				sendEvent(sess, transcriptEvent{Type: "transcript", Text: chunk.Text, IsFinal: false})
			}
			continue
		}
		if !chunk.IsFinal && time.Since(stableSince) < 250*time.Millisecond {
			continue
		}
		if chunk.IsFinal || time.Since(stableSince) >= 250*time.Millisecond {
			committedText = chunk.Text
			utterCancel()
			break
		}
	}

	if committedText == "" {
		return nil
	}

	// Final committed transcript
	sendEvent(sess, transcriptEvent{Type: "transcript", Text: committedText, IsFinal: true})
	metrics.STTLatencyMs.Observe(float64(time.Since(speechStart).Milliseconds()))
	e.convStore.Append(sess.ID, "user", committedText) //nolint:errcheck

	// Pipeline contexts for this response
	llmCtx, llmCancel := context.WithCancel(ctx)
	ttsCtx, ttsCancel := context.WithCancel(ctx)
	sess.SetPipelineCancel(llmCancel, ttsCancel)
	defer llmCancel()
	defer ttsCancel()

	sess.SetState(session.StateProcessing)
	sendEvent(sess, statusEvent{Type: "status", Status: "processing"})

	// Filler bridges the silent gap while LLM warms up
	go e.filler.Play(llmCtx, sess, queue, 200)

	history, _ := e.convStore.GetHistory(sess.ID)
	llmStart := time.Now()

	// Fan-out LLM tokens: ttsIn for synthesis, replyBuf for full-reply event
	rawTokens := make(chan string, 32)
	ttsIn := make(chan string, 32)
	var replyBuf strings.Builder

	go func() {
		defer close(ttsIn)
		for token := range rawTokens {
			replyBuf.WriteString(token)
			select {
			case ttsIn <- token:
			case <-ttsCtx.Done():
				return
			}
		}
	}()

	llmDone := make(chan error, 1)
	go func() {
		llmDone <- e.llmClient.Stream(llmCtx, committedText, history, queue, rawTokens, llmStart)
		close(rawTokens)
	}()

	sess.SetState(session.StateSpeaking)
	sendEvent(sess, statusEvent{Type: "status", Status: "speaking"})

	if err := e.ttsClient.Stream(ttsCtx, ttsIn, sess, queue, time.Now()); err != nil {
		if llmCtx.Err() == nil && ttsCtx.Err() == nil {
			log.Printf("[%s] TTS error: %v", sess.ID, err)
		}
	}

	if err := <-llmDone; err != nil && llmCtx.Err() == nil {
		log.Printf("[%s] LLM error: %v", sess.ID, err)
	}

	// Send the full AI reply text for the transcript display
	if reply := replyBuf.String(); reply != "" {
		e.convStore.Append(sess.ID, "assistant", reply) //nolint:errcheck
		sess.AppendTurn("0", reply, nil)                // store for CSM conditioning
		sendEvent(sess, replyEvent{Type: "reply", Text: reply})
	}

	sess.SetState(session.StateIdle)
	sendEvent(sess, statusEvent{Type: "status", Status: "idle"})
	return nil
}

// runOutbound drains the audio queue and writes Opus to the outbound track.
func (e *WebRTCEngine) runOutbound(
	ctx context.Context,
	queue *audio.Queue,
	outTrack *webrtc.TrackLocalStaticSample,
) {
	select {
	case <-queue.PlaySignal():
	case <-ctx.Done():
		return
	}

	frameDuration := 20 * time.Millisecond
	ticker := time.NewTicker(frameDuration)
	defer ticker.Stop()

	pcmAccum := make([]int16, 0, outFrameSamples)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			chunk := queue.Pop()
			if chunk == nil {
				continue
			}

			metrics.AudioQueueDepthMs.WithLabelValues("global").Set(float64(queue.TotalMs()))

			pcm24 := BytesToInt16(chunk)
			pcm48 := Upsample24to48(pcm24)
			pcmAccum = append(pcmAccum, pcm48...)

			for len(pcmAccum) >= outFrameSamples {
				frame := pcmAccum[:outFrameSamples]
				pcmAccum = pcmAccum[outFrameSamples:]

				opusFrame, err := e.opusPool.Encode(frame)
				if err != nil {
					continue
				}
				outTrack.WriteSample(media.Sample{ //nolint:errcheck
					Data:     opusFrame,
					Duration: frameDuration,
				})
			}
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

func rmsInt16(samples []int16) float64 {
	if len(samples) == 0 {
		return 0
	}
	var sum float64
	for _, s := range samples {
		f := float64(s) / 32768.0
		sum += f * f
	}
	return math.Sqrt(sum / float64(len(samples)))
}
