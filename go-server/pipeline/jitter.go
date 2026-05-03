package pipeline

// JitterBuffer absorbs uneven WebRTC packet arrival timing and emits
// fixed-size 20ms PCM16 chunks to the STT gRPC stream.
//
// WebRTC delivers Opus frames every ~20ms but with ±20ms jitter due to
// network conditions. Feeding irregular chunk sizes directly to Whisper
// produces degraded transcripts. This buffer normalises arrival into a
// steady stream of exactly ChunkSamples per emission.
//
// At 16kHz mono, 20ms = 320 samples = 640 bytes.

const (
	ChunkSamples = 320 // 20ms at 16kHz mono
)

type JitterBuffer struct {
	buf []int16
	out chan []byte // normalised 20ms PCM16 frames (bytes)
}

// NewJitterBuffer returns a buffer whose output channel has capacity cap.
func NewJitterBuffer(cap int) *JitterBuffer {
	return &JitterBuffer{out: make(chan []byte, cap)}
}

// Push adds decoded PCM16 samples and emits complete 20ms frames.
// Called from the Opus decode goroutine; must not block — the output
// channel capacity (cap=8 = 160ms) provides the jitter window.
func (j *JitterBuffer) Push(decoded []int16) {
	j.buf = append(j.buf, decoded...)
	for len(j.buf) >= ChunkSamples {
		frame := make([]int16, ChunkSamples)
		copy(frame, j.buf[:ChunkSamples])
		j.buf = j.buf[ChunkSamples:]

		// Convert to bytes for gRPC AudioChunk.Data
		b := make([]byte, ChunkSamples*2)
		for i, s := range frame {
			b[i*2] = byte(s)
			b[i*2+1] = byte(s >> 8)
		}

		select {
		case j.out <- b:
		default:
			// Drop oldest by draining one slot and re-pushing
			select {
			case <-j.out:
			default:
			}
			j.out <- b
		}
	}
}

// Out returns the normalised output channel for the STT pipeline to read.
func (j *JitterBuffer) Out() <-chan []byte {
	return j.out
}

// Reset discards buffered samples (called on session interrupt).
func (j *JitterBuffer) Reset() {
	j.buf = j.buf[:0]
	for {
		select {
		case <-j.out:
		default:
			return
		}
	}
}
