package knowledge

import "gorm.io/gorm"

type KnowledgeEntry struct {
	gorm.Model
	Type      string `gorm:"not null;default:'doc'" json:"type"` // faq | doc | product
	Title     string `gorm:"not null"               json:"title"`
	Content   string `gorm:"type:text;not null"     json:"content"`
	Tags      string `gorm:"type:text"              json:"tags"` // comma-separated
	Active    bool   `gorm:"default:true"           json:"active"`
	SortOrder int    `gorm:"default:0"              json:"sort_order"`
}
