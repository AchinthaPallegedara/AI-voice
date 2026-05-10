package calllog

import (
	"encoding/binary"
	"os"
	"path/filepath"
)

// MixAndWriteWAV resamples aiPCM from 24 kHz to 16 kHz, mixes both tracks
// into a single mono PCM16 file, and writes a WAV at path.
func MixAndWriteWAV(path string, userPCM, aiPCM []byte) error {
	aiAt16k := resample(aiPCM, 24000, 16000)

	maxLen := len(userPCM)
	if len(aiAt16k) > maxLen {
		maxLen = len(aiAt16k)
	}
	// round down to sample boundary
	maxLen &^= 1

	userPCM = padPCM(userPCM, maxLen)
	aiAt16k = padPCM(aiAt16k, maxLen)

	mixed := make([]byte, maxLen)
	for i := 0; i < maxLen/2; i++ {
		u := int32(int16(binary.LittleEndian.Uint16(userPCM[i*2:])))
		a := int32(int16(binary.LittleEndian.Uint16(aiAt16k[i*2:])))
		m := u + a
		if m > 32767 {
			m = 32767
		} else if m < -32768 {
			m = -32768
		}
		binary.LittleEndian.PutUint16(mixed[i*2:], uint16(int16(m)))
	}
	return writeWAV(path, 16000, mixed)
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

func padPCM(pcm []byte, toLen int) []byte {
	if len(pcm) >= toLen {
		return pcm[:toLen]
	}
	out := make([]byte, toLen)
	copy(out, pcm)
	return out
}

func writeWAV(path string, sampleRate uint32, pcm []byte) error {
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
	write(sampleRate * 2)
	write(uint16(2))
	write(uint16(16))
	f.WriteString("data")
	write(dataSize)
	f.Write(pcm)
	return nil
}
