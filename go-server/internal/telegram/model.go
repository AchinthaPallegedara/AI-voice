package telegram

import "gorm.io/gorm"

type Channel struct {
	gorm.Model
	BotToken      string `gorm:"type:text;not null" json:"bot_token"`
	BotUsername   string `json:"bot_username"`
	WebhookSecret string `gorm:"type:text"         json:"webhook_secret"`
	Active        bool   `gorm:"default:true"      json:"active"`
}

func (Channel) TableName() string { return "telegram_channels" }
