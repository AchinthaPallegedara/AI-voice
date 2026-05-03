package session

import (
	"context"
	"sync"
	"time"

	"voice-agent/go-server/store"
)

type State int

const (
	StateIdle State = iota
	StateListening
	StateProcessing
	StateSpeaking
)

const maxRecentTurns = 3

// TurnAudio holds the audio and text of one conversation turn.
// Used for CSM conditioning: Go sends this with every TTS request so Python
// can condition the voice on how the previous turns actually sounded.
type TurnAudio struct {
	Role  string // "0" = assistant, "1" = user
	Text  string
	Audio []byte // PCM16 24kHz
}

type Session struct {
	ID    string
	IP    string
	state State
	mu    sync.Mutex

	// Pipeline cancellation — replaced on each new utterance
	cancelLLM context.CancelFunc
	cancelTTS context.CancelFunc

	// Conversation state
	ConvStore   store.ConversationStore
	RecentTurns []TurnAudio

	// Stability-window state for speculative LLM execution
	lastTranscript  string
	transcriptSince time.Time
	fillerIndex     int

	// Populated by the caller after construction
	AudioQueue interface{ Clear() }

	// SendEvent sends a JSON string to the browser via the DataChannel.
	// Set by webrtc.go once the DataChannel is open; no-op if nil.
	SendEvent func(msg string)

	// Timestamp of last audio received (for idle timeout)
	LastActivity time.Time
}

func New(id, ip string, cs store.ConversationStore) *Session {
	return &Session{
		ID:           id,
		IP:           ip,
		state:        StateIdle,
		ConvStore:    cs,
		LastActivity: time.Now(),
	}
}

func (s *Session) State() State {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state
}

func (s *Session) SetState(st State) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = st
}

// Interrupt stops any in-flight LLM and TTS and clears the audio queue.
// Called when new speech is detected while the AI is speaking (Go-side only).
func (s *Session) Interrupt() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancelLLM != nil {
		s.cancelLLM()
	}
	if s.cancelTTS != nil {
		s.cancelTTS()
	}
	if s.AudioQueue != nil {
		s.AudioQueue.Clear()
	}
	s.state = StateListening
}

// SetPipelineCancel stores the cancellation functions for the current utterance.
func (s *Session) SetPipelineCancel(cancelLLM, cancelTTS context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cancelLLM = cancelLLM
	s.cancelTTS = cancelTTS
}

// AppendTurn stores audio+text for a completed turn (capped at maxRecentTurns).
func (s *Session) AppendTurn(role, text string, audio []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RecentTurns = append(s.RecentTurns, TurnAudio{Role: role, Text: text, Audio: audio})
	if len(s.RecentTurns) > maxRecentTurns {
		s.RecentTurns = s.RecentTurns[1:]
	}
}

// NextFillerKey returns the next filler label in rotation (to avoid repetition).
func (s *Session) NextFillerKey(keys []string) string {
	if len(keys) == 0 {
		return ""
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := keys[s.fillerIndex%len(keys)]
	s.fillerIndex++
	return key
}

// OnActivity updates the last-activity timestamp (called on audio receipt).
func (s *Session) OnActivity() {
	s.mu.Lock()
	s.LastActivity = time.Now()
	s.mu.Unlock()
}
