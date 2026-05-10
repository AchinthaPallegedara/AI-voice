package user

import "gorm.io/gorm"

type User struct {
	gorm.Model
	TenantID     uint   `gorm:"not null;index"`
	Email        string `gorm:"uniqueIndex;not null"`
	PasswordHash string `gorm:"not null"`
}
