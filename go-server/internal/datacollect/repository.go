package datacollect

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	GetSchema(ctx context.Context, db *gorm.DB) (*CollectedDataSchema, error)
	UpsertSchema(ctx context.Context, db *gorm.DB, schema *CollectedDataSchema) error
	CreateRecord(ctx context.Context, db *gorm.DB, r *CollectedRecord) error
	ListRecords(ctx context.Context, db *gorm.DB, channel string, from, to *time.Time) ([]*CollectedRecord, error)
	FindRecord(ctx context.Context, db *gorm.DB, id uint) (*CollectedRecord, error)
}

type postgresRepository struct{}

func NewRepository() Repository { return &postgresRepository{} }

func (r *postgresRepository) GetSchema(ctx context.Context, db *gorm.DB) (*CollectedDataSchema, error) {
	var s CollectedDataSchema
	if err := db.WithContext(ctx).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *postgresRepository) UpsertSchema(ctx context.Context, db *gorm.DB, schema *CollectedDataSchema) error {
	var existing CollectedDataSchema
	err := db.WithContext(ctx).First(&existing).Error
	if err != nil {
		// no schema yet — create
		return db.WithContext(ctx).Create(schema).Error
	}
	existing.Fields = schema.Fields
	return db.WithContext(ctx).Save(&existing).Error
}

func (r *postgresRepository) CreateRecord(ctx context.Context, db *gorm.DB, rec *CollectedRecord) error {
	return db.WithContext(ctx).Create(rec).Error
}

func (r *postgresRepository) ListRecords(ctx context.Context, db *gorm.DB, channel string, from, to *time.Time) ([]*CollectedRecord, error) {
	q := db.WithContext(ctx).Order("created_at desc")
	if channel != "" {
		q = q.Where("channel = ?", channel)
	}
	if from != nil {
		q = q.Where("created_at >= ?", from)
	}
	if to != nil {
		q = q.Where("created_at <= ?", to)
	}
	var records []*CollectedRecord
	return records, q.Find(&records).Error
}

func (r *postgresRepository) FindRecord(ctx context.Context, db *gorm.DB, id uint) (*CollectedRecord, error) {
	var rec CollectedRecord
	if err := db.WithContext(ctx).First(&rec, id).Error; err != nil {
		return nil, err
	}
	return &rec, nil
}
