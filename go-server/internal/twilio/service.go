package twilio

import (
	"context"

	"gorm.io/gorm"
)

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context, db *gorm.DB) (*Channel, error) {
	ch, err := s.repo.Get(ctx, db)
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return ch, err
}

func (s *Service) Save(ctx context.Context, db *gorm.DB, ch *Channel) (*Channel, error) {
	return s.repo.Upsert(ctx, db, ch)
}

func (s *Service) Delete(ctx context.Context, db *gorm.DB) error {
	return s.repo.Delete(ctx, db)
}
