package database

import (
	"voiceagent/internal/tenant"
	"voiceagent/internal/user"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&tenant.Tenant{}, &user.User{}); err != nil {
		return nil, err
	}
	return db, nil
}
