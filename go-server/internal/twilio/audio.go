package twilio

// Codec/resampling utilities bridging Twilio (G.711 µ-law, 8 kHz)
// with Gemini Live (PCM16 LE, 16 kHz input / 24 kHz output).

// mulawDecode converts a single µ-law byte to a linear PCM16 sample.
func mulawDecode(u byte) int16 {
	u = ^u
	sign := u & 0x80
	exp := (u >> 4) & 0x07
	mant := u & 0x0F
	linear := (int(mant)<<3 + 0x84) << exp
	linear -= 0x84
	if sign != 0 {
		return int16(-linear)
	}
	return int16(linear)
}

// mulawEncode converts a linear PCM16 sample to µ-law.
func mulawEncode(s int16) byte {
	const bias = 0x84
	const clip = 32767
	sign := 0
	if s < 0 {
		sign = 0x80
		s = -s
	}
	if int(s) > clip {
		s = clip
	}
	sample := int(s) + bias
	exp := 7
	for exp > 0 && (sample&0x4000) == 0 {
		exp--
		sample <<= 1
	}
	mant := (sample >> 10) & 0x0F
	return ^byte(sign | (exp << 4) | mant)
}

// MulawToGeminiPCM decodes µ-law 8 kHz bytes → PCM16 LE 16 kHz bytes.
func MulawToGeminiPCM(in []byte) []byte {
	// 1: decode µ-law → PCM16 8 kHz
	pcm8k := make([]int16, len(in))
	for i, b := range in {
		pcm8k[i] = mulawDecode(b)
	}
	// 2: linear-interpolation upsample 8 kHz → 16 kHz
	pcm16k := make([]int16, len(pcm8k)*2)
	for i, s := range pcm8k {
		pcm16k[i*2] = s
		if i+1 < len(pcm8k) {
			pcm16k[i*2+1] = int16((int(s) + int(pcm8k[i+1])) / 2)
		} else {
			pcm16k[i*2+1] = s
		}
	}
	// 3: int16 → little-endian bytes
	out := make([]byte, len(pcm16k)*2)
	for i, s := range pcm16k {
		out[i*2] = byte(s)
		out[i*2+1] = byte(uint16(s) >> 8)
	}
	return out
}

// GeminiPCMToMulaw converts PCM16 LE 24 kHz bytes → µ-law 8 kHz bytes.
func GeminiPCMToMulaw(in []byte) []byte {
	// 1: bytes → PCM16 24 kHz
	n := len(in) / 2
	pcm24k := make([]int16, n)
	for i := range pcm24k {
		pcm24k[i] = int16(uint16(in[i*2]) | uint16(in[i*2+1])<<8)
	}
	// 2: decimate 24 kHz → 8 kHz (keep every 3rd sample)
	pcm8k := make([]int16, 0, n/3+1)
	for i := 0; i < n; i += 3 {
		pcm8k = append(pcm8k, pcm24k[i])
	}
	// 3: PCM16 → µ-law
	out := make([]byte, len(pcm8k))
	for i, s := range pcm8k {
		out[i] = mulawEncode(s)
	}
	return out
}
