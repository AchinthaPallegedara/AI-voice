package whatsapp

import (
	"context"

	"gorm.io/gorm"
)

type Repository struct{}

func NewRepository() *Repository { return &Repository{} }

func (r *Repository) Get(ctx context.Context, db *gorm.DB) (*Channel, error) {
	var ch Channel
	err := db.WithContext(ctx).First(&ch).Error
	return &ch, err
}

func (r *Repository) Upsert(ctx context.Context, db *gorm.DB, ch *Channel) (*Channel, error) {
	var existing Channel
	err := db.WithContext(ctx).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		if err2 := db.WithContext(ctx).Create(ch).Error; err2 != nil {
			return nil, err2
		}
		return ch, nil
	}
	if err != nil {
		return nil, err
	}
	ch.Model = existing.Model
	if err := db.WithContext(ctx).Save(ch).Error; err != nil {
		return nil, err
	}
	return ch, nil
}

func (r *Repository) Delete(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).Where("1=1").Delete(&Channel{}).Error
}
