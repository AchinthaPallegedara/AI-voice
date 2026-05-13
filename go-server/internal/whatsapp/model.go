package whatsapp

import "gorm.io/gorm"

type Channel struct {
	gorm.Model
	PhoneNumberID string `gorm:"not null"     json:"phone_number_id"`
	AccessToken   string `gorm:"type:text"    json:"access_token"`
	AppSecret     string `gorm:"type:text"    json:"app_secret"`
	VerifyToken   string `gorm:"not null"     json:"verify_token"`
	DisplayName   string `json:"display_name"`
	Active        bool   `gorm:"default:true" json:"active"`
}

func (Channel) TableName() string { return "whatsapp_channels" }
