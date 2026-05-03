package pipeline

import (
	"context"
	"io"
	"time"

	"google.golang.org/grpc"

	"voice-agent/go-server/metrics"
	pb "voice-agent/go-server/proto"
)

// STTClient streams PCM16 audio chunks to the Python STT service and
// returns a channel of transcript chunks.
//
// Backpressure: audioIn is a bounded channel (cap=8 from the caller).
// If Python is slow, the channel blocks, which propagates back to the
// Opus decoder / WebRTC receiver.
type STTClient struct {
	conn *grpc.ClientConn
	cb   *CircuitBreaker
}

func NewSTTClient(conn *grpc.ClientConn) *STTClient {
	return &STTClient{conn: conn, cb: NewCircuitBreaker("stt")}
}

// Stream opens a bidirectional gRPC stream, forwards audio chunks, and
// returns a read-only channel of TranscriptChunks. The channel is closed
// when the stream ends or ctx is cancelled.
//
// On circuit-open, it immediately sends a synthetic empty final transcript
// so the session can fall through to the fallback response.
func (c *STTClient) Stream(
	ctx context.Context,
	audioIn <-chan []byte,
	sessionID string,
	startTime time.Time,
) (<-chan *pb.TranscriptChunk, error) {
	out := make(chan *pb.TranscriptChunk, 8)

	if !c.cb.Allow() {
		metrics.CircuitOpen.WithLabelValues("stt").Set(1)
		go func() {
			out <- &pb.TranscriptChunk{Text: "", IsFinal: true}
			close(out)
		}()
		return out, nil
	}
	metrics.CircuitOpen.WithLabelValues("stt").Set(0)

	stub := pb.NewSTTServiceClient(c.conn)
	stream, err := stub.StreamTranscribe(ctx)
	if err != nil {
		c.cb.OnFailure()
		metrics.GRPCErrors.WithLabelValues("stt", "connect").Inc()
		close(out)
		return out, err
	}

	go func() {
		defer close(out)
		// Send audio chunks
		go func() {
			for chunk := range audioIn {
				if ctx.Err() != nil {
					return
				}
				if err := stream.Send(&pb.AudioChunk{
					Data:      chunk,
					SessionId: sessionID,
				}); err != nil {
					c.cb.OnFailure()
					metrics.GRPCErrors.WithLabelValues("stt", "send").Inc()
					return
				}
			}
			stream.CloseSend() //nolint:errcheck
		}()

		// Receive transcripts
		for {
			resp, err := stream.Recv()
			if err == io.EOF {
				c.cb.OnSuccess()
				return
			}
			if err != nil {
				if ctx.Err() == nil {
					c.cb.OnFailure()
					metrics.GRPCErrors.WithLabelValues("stt", "recv").Inc()
				}
				return
			}
			if resp.IsFinal {
				latency := float64(time.Since(startTime).Milliseconds())
				metrics.STTLatencyMs.Observe(latency)
			}
			select {
			case out <- resp:
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}
