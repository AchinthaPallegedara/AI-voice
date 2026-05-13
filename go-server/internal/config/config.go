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
	R2Endpoint        string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2Region          string
	MetaAppID         string
	MetaAppSecret     string
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env", ".env")

	cfg := &Config{
		GeminiModel:       os.Getenv("GEMINI_MODEL"),
		HTTPAddr:          getEnv("HTTP_ADDR", ":8080"),
		CORSOrigin:        getEnv("CORS_ORIGIN", "http://localhost:3000"),
		RecordingsDir:     getEnv("RECORDINGS_DIR", "./recordings"),
		R2Endpoint:        os.Getenv("R2_ENDPOINT"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2Region:          getEnv("R2_REGION", "auto"),
	}

	cfg.ControlPlaneDBURL = os.Getenv("CONTROL_PLANE_DATABASE_URL")
	cfg.PostgresBaseDSN = os.Getenv("POSTGRES_BASE_DSN")
	cfg.GeminiAPIKey = os.Getenv("GEMINI_API_KEY")
	cfg.MetaAppID = os.Getenv("META_APP_ID")
	cfg.MetaAppSecret = os.Getenv("META_APP_SECRET")

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
