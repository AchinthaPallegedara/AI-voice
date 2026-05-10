package call

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// CallRecorder is satisfied by *calllog.Service — no import needed.
type CallRecorder interface {
	SaveCall(ctx context.Context, db *gorm.DB, tenantSlug string, startedAt, endedAt time.Time, userPCM, aiPCM []byte, transcript string) error
}
