package calllog

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	Create(ctx context.Context, db *gorm.DB, log *CallLog) error
	Update(ctx context.Context, db *gorm.DB, log *CallLog) error
	List(ctx context.Context, db *gorm.DB) ([]*CallLog, error)
	FindByID(ctx context.Context, db *gorm.DB, id uint) (*CallLog, error)
	SumDurationSecs(ctx context.Context, db *gorm.DB, from time.Time) (int64, error)
}

type postgresRepository struct{}

func NewRepository() Repository { return &postgresRepository{} }

func (r *postgresRepository) Create(ctx context.Context, db *gorm.DB, log *CallLog) error {
	return db.WithContext(ctx).Create(log).Error
}

func (r *postgresRepository) Update(ctx context.Context, db *gorm.DB, log *CallLog) error {
	return db.WithContext(ctx).Save(log).Error
}

func (r *postgresRepository) List(ctx context.Context, db *gorm.DB) ([]*CallLog, error) {
	var logs []*CallLog
	if err := db.WithContext(ctx).Order("started_at DESC").Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

func (r *postgresRepository) FindByID(ctx context.Context, db *gorm.DB, id uint) (*CallLog, error) {
	var log CallLog
	if err := db.WithContext(ctx).First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *postgresRepository) SumDurationSecs(ctx context.Context, db *gorm.DB, from time.Time) (int64, error) {
	var total int64
	err := db.WithContext(ctx).Model(&CallLog{}).
		Where("started_at >= ? AND status = ?", from, "completed").
		Select("COALESCE(SUM(duration_secs), 0)").
		Scan(&total).Error
	return total, err
}
