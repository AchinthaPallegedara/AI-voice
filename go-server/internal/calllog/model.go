package calllog

import (
	"time"

	"gorm.io/gorm"
)

type CallLog struct {
	gorm.Model      `json:"-"`
	ID              uint      `gorm:"primaryKey"        json:"id"`
	StartedAt       time.Time `gorm:"not null"          json:"started_at"`
	EndedAt         time.Time `gorm:"not null"          json:"ended_at"`
	DurationSecs    int       `json:"duration_secs"`
	Transcript      string    `gorm:"type:text"         json:"transcript"`
	AudioPath       string    `json:"audio_path,omitempty"`
	Channel         string    `gorm:"default:'voice'"   json:"channel"`
	ChannelMetadata string    `gorm:"type:text"         json:"channel_metadata,omitempty"`
	CollectedData   string    `gorm:"type:text"         json:"collected_data,omitempty"`
	FunctionCalls   string    `gorm:"type:text"         json:"function_calls,omitempty"`
	Status          string    `gorm:"default:'completed'" json:"status"`
	ErrorMessage    string    `gorm:"type:text"         json:"error_message,omitempty"`
}
