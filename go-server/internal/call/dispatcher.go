package call

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"voiceagent/internal/connector"
	"voiceagent/internal/datacollect"
)

// CompositeDispatcher routes Gemini function calls to the right service.
type CompositeDispatcher struct {
	connectors  *connector.Service
	datacollect *datacollect.Service
	callLogID   uint
	channel     string
	db          *gorm.DB
}

func newDispatcher(
	connectors *connector.Service,
	datacollect *datacollect.Service,
	callLogID uint,
	channel string,
	db *gorm.DB,
) *CompositeDispatcher {
	return &CompositeDispatcher{
		connectors:  connectors,
		datacollect: datacollect,
		callLogID:   callLogID,
		channel:     channel,
		db:          db,
	}
}

func (d *CompositeDispatcher) Dispatch(ctx context.Context, name string, args map[string]any) (string, error) {
	if name == "collect_data" {
		return d.datacollect.HandleFunctionCall(ctx, d.db, d.callLogID, d.channel, args)
	}
	result, err := d.connectors.DispatchByName(ctx, name, args, d.db)
	if err != nil {
		return "", fmt.Errorf("connector dispatch: %w", err)
	}
	return result, nil
}
