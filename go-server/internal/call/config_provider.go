package call

import (
	"context"

	"gorm.io/gorm"
)

// CallConfigProvider is satisfied by *settings.Service without any import.
type CallConfigProvider interface {
	GetForCall(ctx context.Context, db *gorm.DB) (systemPrompt, voice, greeting string, err error)
}
