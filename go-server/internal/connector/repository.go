package connector

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	List(ctx context.Context, db *gorm.DB) ([]*APIConnector, error)
	ListActive(ctx context.Context, db *gorm.DB) ([]*APIConnector, error)
	Create(ctx context.Context, db *gorm.DB, c *APIConnector) error
	Update(ctx context.Context, db *gorm.DB, c *APIConnector) error
	Delete(ctx context.Context, db *gorm.DB, id uint) error
	FindByID(ctx context.Context, db *gorm.DB, id uint) (*APIConnector, error)
}

type postgresRepository struct{}

func NewRepository() Repository { return &postgresRepository{} }

func (r *postgresRepository) List(ctx context.Context, db *gorm.DB) ([]*APIConnector, error) {
	var cs []*APIConnector
	err := db.WithContext(ctx).Order("created_at desc").Find(&cs).Error
	return cs, err
}

func (r *postgresRepository) ListActive(ctx context.Context, db *gorm.DB) ([]*APIConnector, error) {
	var cs []*APIConnector
	err := db.WithContext(ctx).Where("active = ?", true).Find(&cs).Error
	return cs, err
}

func (r *postgresRepository) Create(ctx context.Context, db *gorm.DB, c *APIConnector) error {
	return db.WithContext(ctx).Create(c).Error
}

func (r *postgresRepository) Update(ctx context.Context, db *gorm.DB, c *APIConnector) error {
	return db.WithContext(ctx).Save(c).Error
}

func (r *postgresRepository) Delete(ctx context.Context, db *gorm.DB, id uint) error {
	return db.WithContext(ctx).Delete(&APIConnector{}, id).Error
}

func (r *postgresRepository) FindByID(ctx context.Context, db *gorm.DB, id uint) (*APIConnector, error) {
	var c APIConnector
	if err := db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}
