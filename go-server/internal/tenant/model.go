package tenant

import "gorm.io/gorm"

type Tenant struct {
	gorm.Model
	Slug        string `gorm:"uniqueIndex;not null"`
	Name        string `gorm:"not null"`
	DatabaseURL string `gorm:"not null"`
	APIKey      string `gorm:"uniqueIndex;not null"`
	Plan        string `gorm:"default:free"`
}
