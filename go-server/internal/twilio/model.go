package twilio

import "gorm.io/gorm"

type Channel struct {
	gorm.Model
	AccountSID  string `gorm:"not null"     json:"account_sid"`
	AuthToken   string `gorm:"not null"     json:"auth_token"`
	PhoneNumber string `gorm:"not null"     json:"phone_number"`
	Active      bool   `gorm:"default:true" json:"active"`
}

func (Channel) TableName() string { return "twilio_channels" }
