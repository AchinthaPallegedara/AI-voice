package datacollect

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// ToolDeclaration mirrors the gemini package type to avoid circular imports.
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

func (s *Service) GetSchema(ctx context.Context, db *gorm.DB) ([]FieldDef, error) {
	schema, err := s.repo.GetSchema(ctx, db)
	if err != nil {
		return nil, err
	}
	var fields []FieldDef
	if err := json.Unmarshal([]byte(schema.Fields), &fields); err != nil {
		return nil, err
	}
	return fields, nil
}

func (s *Service) UpdateSchema(ctx context.Context, db *gorm.DB, fields []FieldDef) error {
	b, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	return s.repo.UpsertSchema(ctx, db, &CollectedDataSchema{Fields: string(b)})
}

// BuildCollectionTool returns a Gemini tool declaration for "collect_data" built from the schema.
// Returns nil if schema is empty or not configured.
func (s *Service) BuildCollectionTool(ctx context.Context, db *gorm.DB) (*ToolDeclaration, error) {
	schema, err := s.repo.GetSchema(ctx, db)
	if err != nil {
		return nil, nil // no schema configured — not an error
	}
	var fields []FieldDef
	if err := json.Unmarshal([]byte(schema.Fields), &fields); err != nil || len(fields) == 0 {
		return nil, nil
	}

	// Build JSON Schema for the collect_data function parameters
	properties := map[string]any{}
	var required []string
	for _, f := range fields {
		jsonType := "string"
		if f.Type == "number" {
			jsonType = "number"
		} else if f.Type == "boolean" {
			jsonType = "boolean"
		}
		properties[f.Name] = map[string]any{
			"type":        jsonType,
			"description": f.Label,
		}
		if f.Required {
			required = append(required, f.Name)
		}
	}

	paramsSchema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		paramsSchema["required"] = required
	}

	paramsJSON, err := json.Marshal(paramsSchema)
	if err != nil {
		return nil, err
	}

	return &ToolDeclaration{
		FunctionDeclarations: []FunctionDecl{{
			Name:        "collect_data",
			Description: "Call this function when you have collected the required information from the user. Only call it once per conversation when all mandatory fields are gathered.",
			Parameters:  json.RawMessage(paramsJSON),
		}},
	}, nil
}

// HandleFunctionCall processes a Gemini "collect_data" function call and stores the result.
func (s *Service) HandleFunctionCall(ctx context.Context, db *gorm.DB, callLogID uint, channel string, args map[string]any) (string, error) {
	b, err := json.Marshal(args)
	if err != nil {
		return "", err
	}
	rec := &CollectedRecord{
		CallLogID: callLogID,
		Channel:   channel,
		Data:      string(b),
	}
	if err := s.repo.CreateRecord(ctx, db, rec); err != nil {
		return "", fmt.Errorf("save collected data: %w", err)
	}
	return "Data collected successfully. Thank the user and continue.", nil
}

func (s *Service) ListRecords(ctx context.Context, db *gorm.DB, channel string, from, to *time.Time) ([]*CollectedRecord, error) {
	return s.repo.ListRecords(ctx, db, channel, from, to)
}

func (s *Service) FindRecord(ctx context.Context, db *gorm.DB, id uint) (*CollectedRecord, error) {
	return s.repo.FindRecord(ctx, db, id)
}

// ExportCSV returns a CSV representation of all records.
func (s *Service) ExportCSV(ctx context.Context, db *gorm.DB) ([]byte, error) {
	records, err := s.repo.ListRecords(ctx, db, "", nil, nil)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"id", "call_log_id", "channel", "data", "created_at"})
	for _, r := range records {
		_ = w.Write([]string{
			fmt.Sprintf("%d", r.ID),
			fmt.Sprintf("%d", r.CallLogID),
			r.Channel,
			r.Data,
			r.CreatedAt.Format(time.RFC3339),
		})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}
