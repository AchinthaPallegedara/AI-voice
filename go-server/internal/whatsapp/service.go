package whatsapp

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"gorm.io/gorm"
)

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

// PhoneInfo is returned by OAuthExchange so the frontend can pick a number.
type PhoneInfo struct {
	ID          string `json:"id"`
	PhoneNumber string `json:"phone_number"`
	Name        string `json:"name"`
}

func (s *Service) Get(ctx context.Context, db *gorm.DB) (*Channel, error) {
	ch, err := s.repo.Get(ctx, db)
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return ch, err
}

func (s *Service) Save(ctx context.Context, db *gorm.DB, ch *Channel) (*Channel, error) {
	if ch.VerifyToken == "" {
		tok, err := generateToken()
		if err != nil {
			return nil, err
		}
		ch.VerifyToken = tok
	}
	return s.repo.Upsert(ctx, db, ch)
}

func (s *Service) Delete(ctx context.Context, db *gorm.DB) error {
	return s.repo.Delete(ctx, db)
}

// OAuthURL builds the Meta OAuth dialog URL.
func (s *Service) OAuthURL(appID, redirectURI string) string {
	return "https://www.facebook.com/v19.0/dialog/oauth?" + url.Values{
		"client_id":    {appID},
		"redirect_uri": {redirectURI},
		"scope":        {"whatsapp_business_management,whatsapp_business_messaging"},
		"response_type": {"code"},
	}.Encode()
}

// OAuthExchange trades the authorization code for an access token, then
// fetches the WhatsApp phone numbers linked to the user's Business account.
func (s *Service) OAuthExchange(ctx context.Context, code, redirectURI, appID, appSecret string) (string, []PhoneInfo, error) {
	// 1. Exchange code → access token
	tokenResp, err := http.PostForm("https://graph.facebook.com/v19.0/oauth/access_token", url.Values{
		"client_id":     {appID},
		"client_secret": {appSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	})
	if err != nil {
		return "", nil, fmt.Errorf("token exchange request: %w", err)
	}
	defer tokenResp.Body.Close()
	body, _ := io.ReadAll(tokenResp.Body)
	if tokenResp.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("token exchange: %s", body)
	}
	var tokenData struct {
		AccessToken string `json:"access_token"`
		Error       *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &tokenData); err != nil {
		return "", nil, fmt.Errorf("parse token response: %w", err)
	}
	if tokenData.Error != nil {
		return "", nil, fmt.Errorf("meta error: %s", tokenData.Error.Message)
	}
	token := tokenData.AccessToken

	// 2. Fetch WABA phone numbers via the businesses edge
	phones, err := s.fetchPhoneNumbers(ctx, token)
	if err != nil {
		return "", nil, err
	}
	return token, phones, nil
}

func (s *Service) fetchPhoneNumbers(ctx context.Context, token string) ([]PhoneInfo, error) {
	apiURL := "https://graph.facebook.com/v19.0/me/businesses?" + url.Values{
		"fields":       {"whatsapp_business_accounts{phone_numbers{id,display_phone_number,verified_name}}"},
		"access_token": {token},
	}.Encode()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch businesses: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Data []struct {
			WhatsAppBusinessAccounts struct {
				Data []struct {
					PhoneNumbers struct {
						Data []struct {
							ID          string `json:"id"`
							PhoneNumber string `json:"display_phone_number"`
							Name        string `json:"verified_name"`
						} `json:"data"`
					} `json:"phone_numbers"`
				} `json:"data"`
			} `json:"whatsapp_business_accounts"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse businesses: %w", err)
	}

	var phones []PhoneInfo
	for _, biz := range result.Data {
		for _, waba := range biz.WhatsAppBusinessAccounts.Data {
			for _, p := range waba.PhoneNumbers.Data {
				phones = append(phones, PhoneInfo{
					ID:          p.ID,
					PhoneNumber: p.PhoneNumber,
					Name:        p.Name,
				})
			}
		}
	}
	return phones, nil
}

// SendTextMessage sends a text reply via WhatsApp Cloud API.
func (s *Service) SendTextMessage(ctx context.Context, ch *Channel, to, text string) error {
	payload := map[string]any{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text":              map[string]string{"body": text},
	}
	b, _ := json.Marshal(payload)
	apiURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/messages", ch.PhoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+ch.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("whatsapp api: %s", resp.Status)
	}
	return nil
}

func generateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
