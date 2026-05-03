package session

import (
	"errors"
	"sync"
	"time"

	"voice-agent/go-server/store"
)

const (
	MaxConcurrentSessions = 20
	MaxSessionsPerIP      = 3
	IdleTimeoutSec        = 30
)

var (
	ErrTooManySessions = errors.New("server at capacity")
	ErrRateLimited     = errors.New("too many sessions from this IP")
)

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	ipCounts map[string]int
	convStore store.ConversationStore
}

func NewManager(cs store.ConversationStore) *Manager {
	m := &Manager{
		sessions:  make(map[string]*Session),
		ipCounts:  make(map[string]int),
		convStore: cs,
	}
	go m.reapIdle()
	return m
}

func (m *Manager) Create(id, ip string) (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.sessions) >= MaxConcurrentSessions {
		return nil, ErrTooManySessions
	}
	if m.ipCounts[ip] >= MaxSessionsPerIP {
		return nil, ErrRateLimited
	}

	s := New(id, ip, m.convStore)
	m.sessions[id] = s
	m.ipCounts[ip]++
	return s, nil
}

func (m *Manager) Get(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

func (m *Manager) Delete(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[id]
	if !ok {
		return
	}
	s.Interrupt()
	m.convStore.Clear(id) //nolint:errcheck
	if m.ipCounts[s.IP] > 0 {
		m.ipCounts[s.IP]--
	}
	delete(m.sessions, id)
}

func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// reapIdle runs every 10s and deletes sessions idle for > IdleTimeoutSec.
func (m *Manager) reapIdle() {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		cutoff := time.Now().Add(-IdleTimeoutSec * time.Second)
		m.mu.Lock()
		for id, s := range m.sessions {
			s.mu.Lock()
			idle := s.LastActivity.Before(cutoff)
			s.mu.Unlock()
			if idle {
				s.Interrupt()
				m.convStore.Clear(id) //nolint:errcheck
				if m.ipCounts[s.IP] > 0 {
					m.ipCounts[s.IP]--
				}
				delete(m.sessions, id)
			}
		}
		m.mu.Unlock()
	}
}
