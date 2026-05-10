package connector

import "gorm.io/gorm"

type APIConnector struct {
	gorm.Model
	Name         string `gorm:"not null"       json:"name"`
	Description  string `gorm:"type:text"      json:"description"`
	BaseURL      string `gorm:"not null"       json:"base_url"`
	Method       string `gorm:"default:'GET'"  json:"method"`
	PathTemplate string `gorm:"type:text"      json:"path_template"`
	Headers      string `gorm:"type:text"      json:"headers"`
	BodyTemplate string `gorm:"type:text"      json:"body_template"`
	ParamsSchema string `gorm:"type:text"      json:"params_schema"`
	Active       bool   `gorm:"default:true"   json:"active"`
}
