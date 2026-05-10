package settings

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	return db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"ai_name", "system_prompt", "voice", "greeting",
				"business_name", "business_description", "agent_goal",
				"timezone", "language", "max_call_duration_secs", "data_collection_enabled",
				"updated_at",
			}),
		}).
		Create(s).Error
}
