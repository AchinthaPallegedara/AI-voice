package knowledge

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	List(ctx context.Context, db *gorm.DB) ([]*KnowledgeEntry, error)
	ListActive(ctx context.Context, db *gorm.DB) ([]*KnowledgeEntry, error)
	Create(ctx context.Context, db *gorm.DB, e *KnowledgeEntry) error
	Update(ctx context.Context, db *gorm.DB, e *KnowledgeEntry) error
	Delete(ctx context.Context, db *gorm.DB, id uint) error
	FindByID(ctx context.Context, db *gorm.DB, id uint) (*KnowledgeEntry, error)
}

type postgresRepository struct{}

func NewRepository() Repository { return &postgresRepository{} }

func (r *postgresRepository) List(ctx context.Context, db *gorm.DB) ([]*KnowledgeEntry, error) {
	var entries []*KnowledgeEntry
	err := db.WithContext(ctx).Order("sort_order asc, created_at desc").Find(&entries).Error
	return entries, err
}

func (r *postgresRepository) ListActive(ctx context.Context, db *gorm.DB) ([]*KnowledgeEntry, error) {
	var entries []*KnowledgeEntry
	err := db.WithContext(ctx).Where("active = ?", true).Order("sort_order asc, type asc").Find(&entries).Error
	return entries, err
}

func (r *postgresRepository) Create(ctx context.Context, db *gorm.DB, e *KnowledgeEntry) error {
	return db.WithContext(ctx).Create(e).Error
}

func (r *postgresRepository) Update(ctx context.Context, db *gorm.DB, e *KnowledgeEntry) error {
	return db.WithContext(ctx).Save(e).Error
}

func (r *postgresRepository) Delete(ctx context.Context, db *gorm.DB, id uint) error {
	return db.WithContext(ctx).Delete(&KnowledgeEntry{}, id).Error
}

func (r *postgresRepository) FindByID(ctx context.Context, db *gorm.DB, id uint) (*KnowledgeEntry, error) {
	var e KnowledgeEntry
	if err := db.WithContext(ctx).First(&e, id).Error; err != nil {
		return nil, err
	}
	return &e, nil
}
