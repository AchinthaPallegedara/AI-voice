package connector

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

// execute fires an HTTP request for the connector with the given params.
// {param} placeholders in PathTemplate and BodyTemplate are interpolated.
// Returns the response body truncated to 4000 characters.
func execute(c *APIConnector, params map[string]any) (string, error) {
	path := interpolate(c.PathTemplate, params)
	url := strings.TrimRight(c.BaseURL, "/") + "/" + strings.TrimLeft(path, "/")

	var bodyReader io.Reader
	if c.BodyTemplate != "" {
		bodyReader = strings.NewReader(interpolate(c.BodyTemplate, params))
	}

	req, err := http.NewRequest(c.Method, url, bodyReader)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}

	if c.BodyTemplate != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Apply custom headers from JSON map
	if c.Headers != "" {
		var headers map[string]string
		if err := json.Unmarshal([]byte(c.Headers), &headers); err == nil {
			for k, v := range headers {
				req.Header.Set(k, v)
			}
		}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	result := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body))
	if len(result) > 4000 {
		result = result[:4000] + "..."
	}
	return result, nil
}

// interpolate replaces {key} placeholders with values from params.
func interpolate(template string, params map[string]any) string {
	result := template
	for k, v := range params {
		result = strings.ReplaceAll(result, "{"+k+"}", fmt.Sprintf("%v", v))
	}
	return result
}
