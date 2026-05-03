package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"voice-agent/go-server/metrics"
	"voice-agent/go-server/session"
	"voice-agent/go-server/transport"
)

// Handler wires up all HTTP routes.
func Handler(mgr *session.Manager, engine *transport.WebRTCEngine, frontendDir string) http.Handler {
	mux := http.NewServeMux()

	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/settings", settingsHandler)

	// WebRTC signaling
	mux.HandleFunc("/signal", engine.HandleOffer)
	mux.HandleFunc("/ice", engine.HandleICE)

	// Serve React frontend
	if frontendDir != "" {
		fs := http.FileServer(http.Dir(frontendDir))
		mux.Handle("/assets/", fs)
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" || !fileExists(frontendDir, r.URL.Path) {
				http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	}

	_ = metrics.ActiveSessions // ensure package init runs
	return rateLimitMiddleware(mgr, mux)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ready": true}) //nolint:errcheck
}

type settings struct {
	AIName       string `json:"ai_name"`
	SystemPrompt string `json:"system_prompt"`
}

var settingsFile = "settings.json"

func settingsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(settingsFile)
		if err != nil {
			data = []byte(`{"ai_name":"Aria","system_prompt":"You are a helpful voice assistant."}`)
		}
		w.Write(data) //nolint:errcheck
	case http.MethodPost:
		var s settings
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		data, _ := json.MarshalIndent(s, "", "  ")
		os.WriteFile(settingsFile, data, 0644) //nolint:errcheck
		json.NewEncoder(w).Encode(map[string]bool{"ok": true}) //nolint:errcheck
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// rateLimitMiddleware rejects /signal requests when the IP is over the per-IP cap.
// The actual session is created inside WebRTCEngine.HandleOffer; this middleware
// only performs a pre-flight count check so we can return 429 before doing WebRTC work.
func rateLimitMiddleware(mgr *session.Manager, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/signal" && r.Method == http.MethodPost {
			if mgr.Count() >= session.MaxConcurrentSessions {
				http.Error(w, "server at capacity", http.StatusServiceUnavailable)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func fileExists(dir, path string) bool {
	_, err := os.Stat(filepath.Join(dir, path))
	return err == nil
}
