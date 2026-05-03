package pipeline

import (
	"context"

	"voice-agent/go-server/audio"
	"voice-agent/go-server/session"
)

var fillerKeys = []string{
	"Mm-hmm.",
	"Right.",
	"Got it.",
	"Hmm...",
	"Sure!",
	"One moment.",
	"Let me think about that.",
}

// FillerPlayer fetches pre-cached acknowledgment audio and queues it
// immediately after transcript commit — before the first LLM token arrives.
// This bridges the silent gap that makes voice agents feel robotic.
type FillerPlayer struct {
	tts *TTSClient
}

func NewFillerPlayer(tts *TTSClient) *FillerPlayer {
	return &FillerPlayer{tts: tts}
}

// Play queues a filler clip for the session.
// estimatedDelayMs is the caller's guess at how long the LLM will take;
// if it's short (<150ms) skip the filler to avoid awkward overlap.
func (f *FillerPlayer) Play(
	ctx context.Context,
	sess *session.Session,
	queue *audio.Queue,
	estimatedDelayMs int,
) {
	if estimatedDelayMs < 150 {
		return
	}
	key := sess.NextFillerKey(fillerKeys)
	if key == "" {
		return
	}
	audio, err := f.tts.GetFiller(ctx, key)
	if err != nil || len(audio) == 0 {
		return
	}
	queue.Push(audio)
}
