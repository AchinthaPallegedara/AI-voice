package pipeline

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"voice-agent/go-server/audio"
	"voice-agent/go-server/metrics"
	"voice-agent/go-server/store"
)

const (
	deepseekBaseURL = "https://api.deepseek.com"
	deepseekModel   = "deepseek-chat"
)

type LLMClient struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

func NewLLMClient() *LLMClient {
	return &LLMClient{
		apiKey:     os.Getenv("DEEPSEEK_API_KEY"),
		baseURL:    getEnv("DEEPSEEK_BASE_URL", deepseekBaseURL),
		model:      getEnv("DEEPSEEK_MODEL", deepseekModel),
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Stream sends conversation history + user message to DeepSeek with streaming
// enabled and forwards tokens to tokenOut. Applies backpressure by pausing
// when the audio queue is near TargetBufferMs*2.
func (c *LLMClient) Stream(
	ctx context.Context,
	userText string,
	history []store.Message,
	queue *audio.Queue,
	tokenOut chan<- string,
	startTime time.Time,
) error {
	messages := buildMessages(history, userText)

	body, _ := json.Marshal(map[string]any{
		"model":    c.model,
		"messages": messages,
		"stream":   true,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("llm request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("llm do: %w", err)
	}
	defer resp.Body.Close()

	firstToken := true
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		token := chunk.Choices[0].Delta.Content
		if token == "" {
			continue
		}

		if firstToken {
			metrics.LLMFirstTokenMs.Observe(float64(time.Since(startTime).Milliseconds()))
			firstToken = false
		}

		// Backpressure: pause if audio queue is building up
		for queue.TotalMs() > audio.TargetBufferMs*2 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(10 * time.Millisecond):
			}
		}

		select {
		case tokenOut <- token:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return scanner.Err()
}

func buildMessages(history []store.Message, userText string) []map[string]string {
	msgs := []map[string]string{{"role": "system", "content": getSystemPrompt()}}
	for _, m := range history {
		if m.Role == "system" {
			continue // skip stored system messages; we always prepend a fresh one
		}
		msgs = append(msgs, map[string]string{"role": m.Role, "content": m.Content})
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": userText})
	return msgs
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

func getSystemPrompt() string {
	if v := os.Getenv("SYSTEM_PROMPT"); v != "" {
		return v
	}
	return "You are a helpful and friendly voice assistant. " +
		"Keep responses concise and conversational — avoid markdown, " +
		"bullet points, code blocks, or any special formatting."
}

// BuildSystemMessage returns the system prompt message for the conversation.
func BuildSystemMessage() store.Message {
	return store.Message{Role: "system", Content: getSystemPrompt()}
}

// LLM responds to the TTS client via a token channel. This helper collects
// the full response text from tokens for conversation history storage.
func CollectResponse(ctx context.Context, tokenOut <-chan string) (string, error) {
	var sb strings.Builder
	for {
		select {
		case token, ok := <-tokenOut:
			if !ok {
				return sb.String(), nil
			}
			sb.WriteString(token)
		case <-ctx.Done():
			return sb.String(), ctx.Err()
		}
	}
}

var _ = io.EOF // keep import
