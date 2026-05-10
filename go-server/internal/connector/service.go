package connector

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"
)

// ToolDeclaration matches the Gemini function calling setup format.
type ToolDeclaration struct {
	FunctionDeclarations []FunctionDecl `json:"functionDeclarations"`
}

type FunctionDecl struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// BuildGeminiTools converts active connectors into Gemini tool declarations.
func (s *Service) BuildGeminiTools(ctx context.Context, db *gorm.DB) ([]ToolDeclaration, error) {
	connectors, err := s.repo.ListActive(ctx, db)
	if err != nil || len(connectors) == 0 {
		return nil, err
	}

	var decls []FunctionDecl
	for _, c := range connectors {
		params := json.RawMessage(`{"type":"object","properties":{}}`)
		if c.ParamsSchema != "" {
			params = json.RawMessage(c.ParamsSchema)
		}
		decls = append(decls, FunctionDecl{
			Name:        sanitizeName(c.Name),
			Description: c.Description,
			Parameters:  params,
		})
	}

	if len(decls) == 0 {
		return nil, nil
	}
	return []ToolDeclaration{{FunctionDeclarations: decls}}, nil
}

// DispatchByName finds the connector by sanitized name and executes it.
func (s *Service) DispatchByName(ctx context.Context, name string, args map[string]any, db *gorm.DB) (string, error) {
	connectors, err := s.repo.ListActive(ctx, db)
	if err != nil {
		return "", err
	}
	for _, c := range connectors {
		if sanitizeName(c.Name) == name {
			return execute(c, args)
		}
	}
	return "", fmt.Errorf("connector %q not found", name)
}

func (s *Service) List(ctx context.Context, db *gorm.DB) ([]*APIConnector, error) {
	return s.repo.List(ctx, db)
}

func (s *Service) Create(ctx context.Context, db *gorm.DB, c *APIConnector) (*APIConnector, error) {
	if err := s.repo.Create(ctx, db, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) Update(ctx context.Context, db *gorm.DB, id uint, patch *APIConnector) (*APIConnector, error) {
	existing, err := s.repo.FindByID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	patch.Model = existing.Model
	if err := s.repo.Update(ctx, db, patch); err != nil {
		return nil, err
	}
	return patch, nil
}

func (s *Service) Delete(ctx context.Context, db *gorm.DB, id uint) error {
	return s.repo.Delete(ctx, db, id)
}

func (s *Service) Test(ctx context.Context, db *gorm.DB, id uint, params map[string]any) (string, error) {
	c, err := s.repo.FindByID(ctx, db, id)
	if err != nil {
		return "", fmt.Errorf("connector not found: %w", err)
	}
	return execute(c, params)
}

// sanitizeName makes a connector name safe as a Gemini function name (alphanumeric + underscore).
func sanitizeName(name string) string {
	var out []byte
	for _, b := range []byte(name) {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') {
			out = append(out, b)
		} else {
			out = append(out, '_')
		}
	}
	if len(out) == 0 {
		return "connector"
	}
	return string(out)
}
