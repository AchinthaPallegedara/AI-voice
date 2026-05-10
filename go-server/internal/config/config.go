package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ControlPlaneDBURL string
	PostgresBaseDSN   string
	GeminiAPIKey      string
	GeminiModel       string
	HTTPAddr          string
	CORSOrigin        string
	RecordingsDir     string
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env", ".env")

	cfg := &Config{
		GeminiModel:   os.Getenv("GEMINI_MODEL"),
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		CORSOrigin:    getEnv("CORS_ORIGIN", "http://localhost:3000"),
		RecordingsDir: getEnv("RECORDINGS_DIR", "./recordings"),
	}

	cfg.ControlPlaneDBURL = os.Getenv("CONTROL_PLANE_DATABASE_URL")
	cfg.PostgresBaseDSN = os.Getenv("POSTGRES_BASE_DSN")
	cfg.GeminiAPIKey = os.Getenv("GEMINI_API_KEY")

	if cfg.ControlPlaneDBURL == "" {
		return nil, errors.New("CONTROL_PLANE_DATABASE_URL is required")
	}
	if cfg.PostgresBaseDSN == "" {
		return nil, errors.New("POSTGRES_BASE_DSN is required")
	}
	if cfg.GeminiAPIKey == "" {
		return nil, errors.New("GEMINI_API_KEY is required")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
