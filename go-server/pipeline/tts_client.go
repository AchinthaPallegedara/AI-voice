package pipeline

import (
	"context"
	"io"
	"time"

	"google.golang.org/grpc"

	"voice-agent/go-server/audio"
	"voice-agent/go-server/metrics"
	pb "voice-agent/go-server/proto"
	"voice-agent/go-server/session"
)

// TTSClient streams text tokens to the Python TTS service and pushes
// received audio chunks into the session's audio queue.
type TTSClient struct {
	conn *grpc.ClientConn
	cb   *CircuitBreaker
}

func NewTTSClient(conn *grpc.ClientConn) *TTSClient {
	return &TTSClient{conn: conn, cb: NewCircuitBreaker("tts")}
}

// Stream opens a gRPC stream to Python TTS. For each incoming token it sends
// a TextChunk with the session's RecentTurns as CSM conditioning context.
// Received audio chunks are pushed to the queue.
//
// On circuit-open, the session falls through to a text-only fallback.
func (c *TTSClient) Stream(
	ctx context.Context,
	tokenIn <-chan string,
	sess *session.Session,
	queue *audio.Queue,
	startTime time.Time,
) error {
	if !c.cb.Allow() {
		metrics.CircuitOpen.WithLabelValues("tts").Set(1)
		return nil
	}
	metrics.CircuitOpen.WithLabelValues("tts").Set(0)

	stub := pb.NewTTSServiceClient(c.conn)
	stream, err := stub.StreamSynthesize(ctx)
	if err != nil {
		c.cb.OnFailure()
		metrics.GRPCErrors.WithLabelValues("tts", "connect").Inc()
		return err
	}

	// Build CSM context from the session's recent turns
	pbContext := buildPBContext(sess.RecentTurns)

	firstChunk := true
	errCh := make(chan error, 1)

	// Send goroutine
	go func() {
		first := true
		for token := range tokenIn {
			if ctx.Err() != nil {
				errCh <- ctx.Err()
				return
			}
			msg := &pb.TextChunk{
				Text:      token,
				SessionId: sess.ID,
			}
			if first {
				msg.Context = pbContext
				first = false
			}
			if err := stream.Send(msg); err != nil {
				c.cb.OnFailure()
				metrics.GRPCErrors.WithLabelValues("tts", "send").Inc()
				errCh <- err
				return
			}
		}
		stream.CloseSend() //nolint:errcheck
		errCh <- nil
	}()

	// Receive goroutine (same goroutine as caller to keep ordering)
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			c.cb.OnSuccess()
			return <-errCh
		}
		if err != nil {
			if ctx.Err() == nil {
				c.cb.OnFailure()
				metrics.GRPCErrors.WithLabelValues("tts", "recv").Inc()
			}
			return err
		}
		if firstChunk && len(resp.Data) > 0 {
			metrics.TTSFirstChunkMs.Observe(float64(time.Since(startTime).Milliseconds()))
			firstChunk = false
		}
		queue.Push(resp.Data)
	}
}

// GetFiller fetches a pre-cached filler audio clip (zero inference latency).
func (c *TTSClient) GetFiller(ctx context.Context, key string) ([]byte, error) {
	stub := pb.NewTTSServiceClient(c.conn)
	resp, err := stub.GetFiller(ctx, &pb.FillerRequest{Key: key})
	if err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func buildPBContext(turns []session.TurnAudio) []*pb.ConversationTurn {
	out := make([]*pb.ConversationTurn, 0, len(turns))
	for _, t := range turns {
		out = append(out, &pb.ConversationTurn{
			Role:  t.Role,
			Text:  t.Text,
			Audio: t.Audio,
		})
	}
	return out
}
