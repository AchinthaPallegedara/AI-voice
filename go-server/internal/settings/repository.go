package settings

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	Get(ctx context.Context, db *gorm.DB) (*Settings, error)
	Upsert(ctx context.Context, db *gorm.DB, s *Settings) error
}

type postgresRepository struct{}

func NewRepository() Repository { return &postgresRepository{} }

func (r *postgresRepository) Get(ctx context.Context, db *gorm.DB) (*Settings, error) {
	var s Settings
	if err := db.WithContext(ctx).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *postgresRepository) Upsert(ctx context.Context, db *gorm.DB, s *Settings) error {
	var existing Settings
	if err := db.WithContext(ctx).First(&existing).Error; err == nil {
		s.ID = existing.ID
		s.CreatedAt = existing.CreatedAt
	}
	return db.WithContext(ctx).Save(s).Error
}
