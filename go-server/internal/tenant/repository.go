package tenant

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	FindByAPIKey(ctx context.Context, key string) (*Tenant, error)
	FindByID(ctx context.Context, id uint) (*Tenant, error)
	Create(ctx context.Context, t *Tenant) error
}

type postgresRepository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) FindByAPIKey(ctx context.Context, key string) (*Tenant, error) {
	var t Tenant
	if err := r.db.WithContext(ctx).Where("api_key = ?", key).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, id uint) (*Tenant, error) {
	var t Tenant
	if err := r.db.WithContext(ctx).First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *postgresRepository) Create(ctx context.Context, t *Tenant) error {
	return r.db.WithContext(ctx).Create(t).Error
}
