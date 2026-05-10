package calllog

import (
	"encoding/binary"
	"os"
	"path/filepath"
)

// TimedChunk is a PCM audio chunk paired with its offset from call start.
type TimedChunk struct {
	Data     []byte
	OffsetMs int64
}

// Record at the AI's native sample rate to avoid degrading its audio.
// User mic audio (16 kHz) is upsampled to match — upsampling is lossless,
// downsampling is not.
const recordSampleRate = 24000
const micSampleRate = 16000

// MixAndWriteWAV writes a mono WAV that sounds like the real conversation:
// user audio is the continuous mic stream; each AI chunk is placed at its
// correct timestamp offset so turns play in the right order instead of all
// stacking at t=0.
func MixAndWriteWAV(path string, userPCM []byte, aiChunks []TimedChunk) error {
	// Upsample user mic audio from 16 kHz → 24 kHz (no quality loss).
	userUp := resample(userPCM, micSampleRate, recordSampleRate)
	userSamples := len(userUp) / 2

	// Build the AI track.
	//
	// Strategy: use the arrival timestamp only to find where each *turn* starts.
	// Chunks within the same turn are written contiguously so that normal network
	// jitter between consecutive chunks never creates gaps or overlaps (which
	// cause audible pops/glitches). A gap of >400 ms between consecutive chunk
	// arrivals is treated as a new turn, and the cursor jumps to the timestamp.
	const newTurnThresholdMs = 400
	aiTrackSamples := userSamples
	cursor := 0            // write position in the AI track (samples)
	lastArrivalMs := int64(0)

	type placed struct {
		startSample int
		data        []byte
	}
	placedChunks := make([]placed, 0, len(aiChunks))

	for _, ch := range aiChunks {
		chSamples := len(ch.Data) / 2
		if chSamples == 0 {
			continue
		}

		if cursor == 0 {
			// Very first AI audio — anchor to timestamp.
			cursor = int(float64(ch.OffsetMs) / 1000.0 * recordSampleRate)
		} else if ch.OffsetMs-lastArrivalMs > newTurnThresholdMs {
			// Large gap → new turn. Jump cursor to timestamp so silence is
			// preserved between turns, but never go backwards.
			ts := int(float64(ch.OffsetMs) / 1000.0 * recordSampleRate)
			if ts > cursor {
				cursor = ts
			}
		}
		// else: same turn, place chunk immediately after the previous one.

		placedChunks = append(placedChunks, placed{startSample: cursor, data: ch.Data})
		cursor += chSamples
		lastArrivalMs = ch.OffsetMs

		if cursor > aiTrackSamples {
			aiTrackSamples = cursor
		}
	}

	totalSamples := userSamples
	if aiTrackSamples > totalSamples {
		totalSamples = aiTrackSamples
	}

	aiTrack := make([]byte, totalSamples*2)
	for _, p := range placedChunks {
		dst := p.startSample * 2
		if dst < 0 {
			dst = 0
		}
		n := len(p.data)
		if dst+n > len(aiTrack) {
			n = len(aiTrack) - dst
		}
		if n > 0 {
			copy(aiTrack[dst:dst+n], p.data[:n])
		}
	}

	// Pad user track if shorter than AI track.
	userTrack := userUp
	if len(userTrack) < totalSamples*2 {
		padded := make([]byte, totalSamples*2)
		copy(padded, userTrack)
		userTrack = padded
	}

	// Sum both tracks into mono with clipping protection.
	mono := make([]byte, totalSamples*2)
	for i := 0; i < totalSamples; i++ {
		u := int32(int16(binary.LittleEndian.Uint16(userTrack[i*2:])))
		a := int32(int16(binary.LittleEndian.Uint16(aiTrack[i*2:])))
		m := u + a
		if m > 32767 {
			m = 32767
		} else if m < -32768 {
			m = -32768
		}
		binary.LittleEndian.PutUint16(mono[i*2:], uint16(int16(m)))
	}

	return writeMonoWAV(path, recordSampleRate, mono)
}

// resample converts PCM16 mono from fromRate to toRate using linear interpolation.
func resample(pcm []byte, fromRate, toRate uint32) []byte {
	if fromRate == toRate || len(pcm) < 2 {
		return pcm
	}
	nIn := len(pcm) / 2
	nOut := int(float64(nIn) * float64(toRate) / float64(fromRate))
	out := make([]byte, nOut*2)
	ratio := float64(fromRate) / float64(toRate)
	for i := 0; i < nOut; i++ {
		srcF := float64(i) * ratio
		idx := int(srcF)
		frac := srcF - float64(idx)
		s0 := readSample(pcm, idx)
		s1 := readSample(pcm, idx+1)
		v := int16(float64(s0)*(1-frac) + float64(s1)*frac)
		binary.LittleEndian.PutUint16(out[i*2:], uint16(v))
	}
	return out
}

func readSample(pcm []byte, idx int) int16 {
	off := idx * 2
	if off+1 >= len(pcm) {
		return 0
	}
	return int16(binary.LittleEndian.Uint16(pcm[off:]))
}

func writeMonoWAV(path string, sampleRate uint32, pcm []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	dataSize := uint32(len(pcm))
	le := binary.LittleEndian
	write := func(v any) { binary.Write(f, le, v) } //nolint:errcheck

	f.WriteString("RIFF")
	write(36 + dataSize)
	f.WriteString("WAVE")
	f.WriteString("fmt ")
	write(uint32(16))
	write(uint16(1)) // PCM
	write(uint16(1)) // mono
	write(sampleRate)
	write(sampleRate * 2) // byteRate
	write(uint16(2))      // blockAlign
	write(uint16(16))     // bitsPerSample
	f.WriteString("data")
	write(dataSize)
	f.Write(pcm)
	return nil
}
