package transport

import (
	"fmt"
	"runtime"
	"sync"

	"github.com/hraban/opus"
)

const (
	// Browser sends Opus at 48kHz; we decode directly to 16kHz for STT.
	// Opus natively supports output at 8000, 12000, 16000, 24000, or 48000 Hz.
	sttSampleRate = 16000
	sttChannels   = 1

	// TTS outputs 24kHz PCM16. We upsample to 48kHz before Opus-encoding
	// because WebRTC mandates 48kHz Opus.
	ttsSampleRate = 24000
	outSampleRate = 48000
	outChannels   = 1

	// Pion delivers 20ms Opus frames. At 16kHz mono that is 320 samples.
	// At 48kHz mono it is 960 samples.
	sttFrameSamples = sttSampleRate / 50  // 320
	outFrameSamples = outSampleRate / 50  // 960

	// Generous ceiling for encoded bytes per frame.
	maxOpusBytes = 4000
)

// decodeJob is a single Opus→PCM decode request.
type decodeJob struct {
	payload []byte
	result  chan decodeResult
}

type decodeResult struct {
	pcm []int16
	n   int
	err error
}

// encodeJob is a single PCM→Opus encode request.
type encodeJob struct {
	pcm    []int16
	result chan encodeResult
}

type encodeResult struct {
	opus []byte
	err  error
}

// OpusPool maintains separate worker pools for decoding and encoding.
// Workers are 1:1 with logical CPUs (capped at maxConcurrentSessions).
// This prevents Opus CGo calls from blocking Go scheduler goroutines.
type OpusPool struct {
	decJobs chan decodeJob
	encJobs chan encodeJob
	wg      sync.WaitGroup
}

func NewOpusPool() (*OpusPool, error) {
	n := runtime.GOMAXPROCS(0)
	if n < 2 {
		n = 2
	}

	p := &OpusPool{
		decJobs: make(chan decodeJob, n*4),
		encJobs: make(chan encodeJob, n*4),
	}

	for i := 0; i < n; i++ {
		dec, err := opus.NewDecoder(sttSampleRate, sttChannels)
		if err != nil {
			return nil, fmt.Errorf("opus decoder: %w", err)
		}
		enc, err := opus.NewEncoder(outSampleRate, outChannels, opus.AppVoIP)
		if err != nil {
			return nil, fmt.Errorf("opus encoder: %w", err)
		}
		enc.SetBitrate(24000) // 24 kbps — good quality for voice, low bandwidth

		p.wg.Add(1)
		go p.worker(dec, enc)
	}

	return p, nil
}

func (p *OpusPool) worker(dec *opus.Decoder, enc *opus.Encoder) {
	defer p.wg.Done()
	pcmBuf := make([]int16, sttFrameSamples*4) // headroom for variable frame sizes
	opusBuf := make([]byte, maxOpusBytes)

	for {
		select {
		case job, ok := <-p.decJobs:
			if !ok {
				return
			}
			n, err := dec.Decode(job.payload, pcmBuf)
			var out []int16
			if err == nil {
				out = make([]int16, n)
				copy(out, pcmBuf[:n])
			}
			job.result <- decodeResult{pcm: out, n: n, err: err}

		case job, ok := <-p.encJobs:
			if !ok {
				return
			}
			n, err := enc.Encode(job.pcm, opusBuf)
			var out []byte
			if err == nil {
				out = make([]byte, n)
				copy(out, opusBuf[:n])
			}
			job.result <- encodeResult{opus: out, err: err}
		}
	}
}

// Decode decodes an Opus frame to PCM16 at 16kHz mono (ready for STT).
func (p *OpusPool) Decode(payload []byte) ([]int16, error) {
	r := make(chan decodeResult, 1)
	p.decJobs <- decodeJob{payload: payload, result: r}
	res := <-r
	return res.pcm, res.err
}

// Encode encodes PCM16 at 48kHz mono to Opus.
// Input must be exactly outFrameSamples (960) samples.
func (p *OpusPool) Encode(pcm []int16) ([]byte, error) {
	r := make(chan encodeResult, 1)
	p.encJobs <- encodeJob{pcm: pcm, result: r}
	res := <-r
	return res.opus, res.err
}

// Close shuts down all workers.
func (p *OpusPool) Close() {
	close(p.decJobs)
	close(p.encJobs)
	p.wg.Wait()
}

// Upsample24to48 does linear interpolation from 24kHz to 48kHz (2× ratio).
// Input is raw int16 PCM bytes from the TTS service (WAV stripped).
func Upsample24to48(in []int16) []int16 {
	if len(in) == 0 {
		return nil
	}
	out := make([]int16, len(in)*2)
	for i, s := range in {
		out[i*2] = s
		if i+1 < len(in) {
			out[i*2+1] = int16((int(s) + int(in[i+1])) / 2)
		} else {
			out[i*2+1] = s
		}
	}
	return out
}

// BytesToInt16 converts raw PCM16 bytes (little-endian) to int16 slice.
func BytesToInt16(b []byte) []int16 {
	n := len(b) / 2
	out := make([]int16, n)
	for i := 0; i < n; i++ {
		out[i] = int16(b[i*2]) | int16(b[i*2+1])<<8
	}
	return out
}

// Int16ToBytes converts int16 PCM to raw little-endian bytes.
func Int16ToBytes(pcm []int16) []byte {
	out := make([]byte, len(pcm)*2)
	for i, s := range pcm {
		out[i*2] = byte(s)
		out[i*2+1] = byte(s >> 8)
	}
	return out
}
