package datacollect

import (
	"time"

	"gorm.io/gorm"
)

// FieldDef describes one field in the collection schema.
type FieldDef struct {
	Name     string `json:"name"`
	Label    string `json:"label"`
	Type     string `json:"type"`     // text | email | phone | number | date | boolean
	Required bool   `json:"required"`
}

// CollectedDataSchema holds the per-tenant collection schema (one row).
type CollectedDataSchema struct {
	gorm.Model
	Fields string `gorm:"type:text"` // JSON: []FieldDef
}

// CollectedRecord stores data captured in a single conversation.
type CollectedRecord struct {
	gorm.Model
	CallLogID uint      `gorm:"index"           json:"call_log_id"`
	Channel   string    `gorm:"default:'voice'" json:"channel"`
	Data      string    `gorm:"type:text"       json:"data"` // JSON map[string]any
	CreatedAt time.Time `json:"created_at"`
}
