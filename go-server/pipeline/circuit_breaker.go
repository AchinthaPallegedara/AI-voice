package pipeline

import (
	"sync"
	"time"
)

type cbState int

const (
	cbClosed   cbState = iota
	cbOpen
	cbHalfOpen
)

const (
	cbMaxFailures  = 3
	cbResetAfter   = 5 * time.Second
)

// CircuitBreaker protects a gRPC service connection.
// 3 consecutive failures → open (caller gets fallback).
// After 5s → half-open: next call is a probe; success closes the circuit.
type CircuitBreaker struct {
	mu          sync.Mutex
	state       cbState
	failures    int
	lastFailure time.Time
	name        string
}

func NewCircuitBreaker(name string) *CircuitBreaker {
	return &CircuitBreaker{name: name}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	switch cb.state {
	case cbClosed:
		return true
	case cbOpen:
		if time.Since(cb.lastFailure) > cbResetAfter {
			cb.state = cbHalfOpen
			return true
		}
		return false
	case cbHalfOpen:
		return true
	}
	return true
}

func (cb *CircuitBreaker) OnSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = cbClosed
}

func (cb *CircuitBreaker) OnFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.failures >= cbMaxFailures {
		cb.state = cbOpen
	}
}

func (cb *CircuitBreaker) IsOpen() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state == cbOpen
}
