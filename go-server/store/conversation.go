package store

import (
	"sync"
)

type Message struct {
	Role    string // "user" or "assistant"
	Content string
}

type ConversationStore interface {
	Append(sessionID, role, content string) error
	GetHistory(sessionID string) ([]Message, error)
	Clear(sessionID string) error
}

// InMemoryStore is the default. Swap in RedisStore for production
// without changing any session.go code.
type InMemoryStore struct {
	mu   sync.RWMutex
	data map[string][]Message
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{data: make(map[string][]Message)}
}

func (s *InMemoryStore) Append(sessionID, role, content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[sessionID] = append(s.data[sessionID], Message{Role: role, Content: content})
	return nil
}

func (s *InMemoryStore) GetHistory(sessionID string) ([]Message, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	msgs := s.data[sessionID]
	out := make([]Message, len(msgs))
	copy(out, msgs)
	return out, nil
}

func (s *InMemoryStore) Clear(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, sessionID)
	return nil
}
