package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	"voice-agent/go-server/api"
	"voice-agent/go-server/pipeline"
	"voice-agent/go-server/session"
	"voice-agent/go-server/store"
	"voice-agent/go-server/transport"
)

func main() {
	pythonAddr := getEnv("PYTHON_AI_ADDR", "localhost:50051")
	httpAddr := getEnv("HTTP_ADDR", ":8080")
	frontendDir := getEnv("FRONTEND_DIR", "../frontend/dist")

	// gRPC connection to Python AI (with keepalive so idle connections stay open)
	conn, err := grpc.NewClient(
		pythonAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                10 * time.Second,
			Timeout:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		log.Fatalf("gRPC connect: %v", err)
	}
	defer conn.Close()

	// Opus worker pool (must succeed — libopus must be installed)
	opusPool, err := transport.NewOpusPool()
	if err != nil {
		log.Fatalf("Opus pool: %v (install libopus: brew install opus opusfile)", err)
	}
	defer opusPool.Close()

	convStore := store.NewInMemoryStore()
	mgr := session.NewManager(convStore)

	sttClient := pipeline.NewSTTClient(conn)
	ttsClient := pipeline.NewTTSClient(conn)
	llmClient := pipeline.NewLLMClient()
	fillerPlayer := pipeline.NewFillerPlayer(ttsClient)

	engine := transport.NewWebRTCEngine(mgr, sttClient, ttsClient, llmClient, fillerPlayer, convStore, opusPool)
	handler := api.Handler(mgr, engine, frontendDir)

	srv := &http.Server{
		Addr:         httpAddr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Go server listening on %s", httpAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
