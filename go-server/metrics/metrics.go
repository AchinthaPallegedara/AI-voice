package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
	STTLatencyMs = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "stt_latency_ms",
		Help:    "Time from first audio chunk to is_final=true transcript",
		Buckets: []float64{50, 100, 150, 200, 300, 500, 800},
	})

	LLMFirstTokenMs = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "llm_first_token_ms",
		Help:    "Time from transcript commit to first LLM token",
		Buckets: []float64{50, 100, 150, 200, 300, 500},
	})

	TTSFirstChunkMs = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "tts_first_chunk_ms",
		Help:    "Time from first LLM token to first TTS audio chunk",
		Buckets: []float64{50, 100, 150, 200, 300, 500},
	})

	E2ELatencyMs = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "e2e_latency_ms",
		Help:    "Time from speech_start to first audio played (P95 target <500ms)",
		Buckets: []float64{100, 200, 300, 400, 500, 700, 1000},
	})

	AudioQueueDepthMs = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "audio_queue_depth_ms",
		Help: "Current audio queue depth per session",
	}, []string{"session_id"})

	GRPCErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grpc_errors_total",
		Help: "gRPC errors by service and error type",
	}, []string{"service", "error_type"})

	ActiveSessions = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "active_sessions",
		Help: "Number of active WebRTC sessions",
	})

	DroppedFrames = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "audio_dropped_frames_total",
		Help: "Audio frames dropped due to buffer overflow",
	})

	CircuitOpen = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "circuit_breaker_open",
		Help: "1 when circuit breaker is open for a service",
	}, []string{"service"})
)

func init() {
	prometheus.MustRegister(
		STTLatencyMs,
		LLMFirstTokenMs,
		TTSFirstChunkMs,
		E2ELatencyMs,
		AudioQueueDepthMs,
		GRPCErrors,
		ActiveSessions,
		DroppedFrames,
		CircuitOpen,
	)
}
