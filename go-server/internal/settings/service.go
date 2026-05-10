package settings

import (
	"context"

	"gorm.io/gorm"
)

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context, db *gorm.DB) (*Settings, error) {
	return s.repo.Get(ctx, db)
}

func (s *Service) Update(ctx context.Context, db *gorm.DB, in *Settings) (*Settings, error) {
	in.ApplyDefaults()
	if err := s.repo.Upsert(ctx, db, in); err != nil {
		return nil, err
	}
	return s.repo.Get(ctx, db)
}

func (s *Service) GetForCall(ctx context.Context, db *gorm.DB) (systemPrompt, voice, greeting string, err error) {
	settings, err := s.repo.Get(ctx, db)
	if err != nil {
		return
	}
	return settings.ResolvePrompt(), settings.Voice, settings.ResolveGreeting(), nil
}
