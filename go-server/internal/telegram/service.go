package telegram

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"gorm.io/gorm"
)

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

type BotInfo struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"first_name"`
}

func (s *Service) Get(ctx context.Context, db *gorm.DB) (*Channel, error) {
	ch, err := s.repo.Get(ctx, db)
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return ch, err
}

// Setup verifies the bot token, registers the Telegram webhook, and saves the channel.
func (s *Service) Setup(ctx context.Context, db *gorm.DB, token, webhookBaseURL, apiKey string) (*Channel, error) {
	info, err := s.GetMe(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("invalid bot token: %w", err)
	}

	secret, err := generateSecret()
	if err != nil {
		return nil, err
	}

	ch := &Channel{
		BotToken:      token,
		BotUsername:   info.Username,
		WebhookSecret: secret,
		Active:        true,
	}

	webhookURL := fmt.Sprintf("%s/webhook/telegram/%s", webhookBaseURL, apiKey)
	if err := s.SetWebhook(ctx, ch, webhookURL); err != nil {
		return nil, fmt.Errorf("register webhook: %w", err)
	}

	return s.repo.Upsert(ctx, db, ch)
}

func (s *Service) Delete(ctx context.Context, db *gorm.DB) error {
	ch, err := s.Get(ctx, db)
	if err == nil && ch != nil {
		_ = s.RemoveWebhook(ctx, ch)
	}
	return s.repo.Delete(ctx, db)
}

func (s *Service) GetMe(ctx context.Context, token string) (*BotInfo, error) {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/getMe", token)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		OK          bool    `json:"ok"`
		Result      BotInfo `json:"result"`
		Description string  `json:"description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if !result.OK {
		return nil, fmt.Errorf("%s", result.Description)
	}
	return &result.Result, nil
}

func (s *Service) SetWebhook(ctx context.Context, ch *Channel, webhookURL string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", ch.BotToken)
	payload := map[string]any{
		"url":             webhookURL,
		"secret_token":    ch.WebhookSecret,
		"allowed_updates": []string{"message"},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("%s", result.Description)
	}
	return nil
}

func (s *Service) RemoveWebhook(ctx context.Context, ch *Channel) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/deleteWebhook", ch.BotToken)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *Service) SendMessage(ctx context.Context, ch *Channel, chatID int64, text string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", ch.BotToken)
	payload := map[string]any{
		"chat_id": chatID,
		"text":    text,
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram sendMessage: %s", body)
	}
	return nil
}

func generateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
