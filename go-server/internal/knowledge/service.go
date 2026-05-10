package knowledge

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// BuildKnowledgeBlock returns formatted text for injection into the agent system prompt.
func (s *Service) BuildKnowledgeBlock(ctx context.Context, db *gorm.DB) (string, error) {
	entries, err := s.repo.ListActive(ctx, db)
	if err != nil || len(entries) == 0 {
		return "", err
	}

	var b strings.Builder
	b.WriteString("== Business Knowledge ==\n")
	for _, e := range entries {
		label := strings.ToUpper(e.Type)
		b.WriteString(fmt.Sprintf("[%s] %s\n%s\n\n", label, e.Title, e.Content))
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

func (s *Service) List(ctx context.Context, db *gorm.DB) ([]*KnowledgeEntry, error) {
	return s.repo.List(ctx, db)
}

func (s *Service) Create(ctx context.Context, db *gorm.DB, e *KnowledgeEntry) (*KnowledgeEntry, error) {
	if err := s.repo.Create(ctx, db, e); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *Service) Update(ctx context.Context, db *gorm.DB, id uint, patch *KnowledgeEntry) (*KnowledgeEntry, error) {
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
