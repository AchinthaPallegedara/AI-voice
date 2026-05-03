package audio

import "sync"

const (
	MinBufferMs    = 80
	TargetBufferMs = 120
	MaxBufferMs    = 300

	// CSM outputs 24kHz PCM16: 2 bytes per sample × 24000 samples/s = 48 bytes/ms
	bytesPerMs = 48
)

// Queue is a thread-safe audio playback buffer with jitter control.
//
// Push drops oldest frames (not newest) when the buffer exceeds MaxBufferMs,
// preserving word-final syllables at the cost of losing stale leading audio.
// playSignal fires once when MinBufferMs is first reached.
type Queue struct {
	mu         sync.Mutex
	buf        [][]byte
	totalBytes int
	playSignal chan struct{}
}

func NewQueue() *Queue {
	return &Queue{playSignal: make(chan struct{}, 1)}
}

func (q *Queue) Push(chunk []byte) {
	if len(chunk) == 0 {
		return
	}
	q.mu.Lock()
	defer q.mu.Unlock()

	incoming := len(chunk)
	maxBytes := MaxBufferMs * bytesPerMs

	// Drop oldest frames to make room (preserves continuity of recent audio)
	for q.totalBytes+incoming > maxBytes && len(q.buf) > 0 {
		oldest := q.buf[0]
		q.buf = q.buf[1:]
		q.totalBytes -= len(oldest)
	}

	q.buf = append(q.buf, chunk)
	q.totalBytes += incoming

	if q.totalBytes >= MinBufferMs*bytesPerMs {
		select {
		case q.playSignal <- struct{}{}:
		default:
		}
	}
}

// Pop removes and returns the next chunk, or nil if empty.
func (q *Queue) Pop() []byte {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.buf) == 0 {
		return nil
	}
	chunk := q.buf[0]
	q.buf = q.buf[1:]
	q.totalBytes -= len(chunk)
	return chunk
}

// Clear drains the queue immediately (called on interrupt).
func (q *Queue) Clear() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.buf = q.buf[:0]
	q.totalBytes = 0
}

func (q *Queue) TotalMs() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.totalBytes / bytesPerMs
}

// PlaySignal returns a channel that fires once MinBufferMs is reached.
func (q *Queue) PlaySignal() <-chan struct{} {
	return q.playSignal
}
