package calllog

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	repo          Repository
	recordingsDir string
}

func NewService(repo Repository, recordingsDir string) *Service {
	return &Service{repo: repo, recordingsDir: recordingsDir}
}

// CreatePrelim inserts an in-progress call log so the dispatcher has a valid ID.
func (s *Service) CreatePrelim(ctx context.Context, db *gorm.DB, cl *CallLog) error {
	if err := s.repo.Create(ctx, db, cl); err != nil {
		return fmt.Errorf("create prelim call log: %w", err)
	}
	return nil
}

// FinishCall updates the preliminary log with final duration, transcript and audio.
func (s *Service) FinishCall(
	ctx context.Context,
	db *gorm.DB,
	id uint,
	tenantSlug string,
	startedAt, endedAt time.Time,
	userPCM, aiPCM []byte,
	transcript string,
) error {
	cl, err := s.repo.FindByID(ctx, db, id)
	if err != nil {
		// Fall back to creating a new record if prelim was never persisted
		cl = &CallLog{}
	}
	cl.StartedAt = startedAt
	cl.EndedAt = endedAt
	cl.DurationSecs = int(endedAt.Sub(startedAt).Seconds())
	cl.Transcript = transcript
	cl.Status = "completed"

	if len(userPCM) > 0 || len(aiPCM) > 0 {
		p := filepath.Join(s.recordingsDir, tenantSlug, fmt.Sprintf("%d.wav", cl.ID))
		if mixErr := MixAndWriteWAV(p, userPCM, aiPCM); mixErr == nil {
			cl.AudioPath = p
		}
	}

	if cl.ID == 0 {
		return s.repo.Create(ctx, db, cl)
	}
	return s.repo.Update(ctx, db, cl)
}

func (s *Service) SaveCall(
	ctx context.Context,
	db *gorm.DB,
	tenantSlug string,
	startedAt, endedAt time.Time,
	userPCM, aiPCM []byte,
	transcript string,
) error {
	cl := &CallLog{
		StartedAt:    startedAt,
		EndedAt:      endedAt,
		DurationSecs: int(endedAt.Sub(startedAt).Seconds()),
		Transcript:   transcript,
		Channel:      "voice",
		Status:       "completed",
	}
	if err := s.repo.Create(ctx, db, cl); err != nil {
		return fmt.Errorf("create call log: %w", err)
	}

	if len(userPCM) > 0 || len(aiPCM) > 0 {
		p := filepath.Join(s.recordingsDir, tenantSlug, fmt.Sprintf("%d.wav", cl.ID))
		if err := MixAndWriteWAV(p, userPCM, aiPCM); err == nil {
			cl.AudioPath = p
			_ = s.repo.Update(ctx, db, cl)
		}
	}
	return nil
}

func (s *Service) ListCalls(ctx context.Context, db *gorm.DB) ([]*CallLog, error) {
	return s.repo.List(ctx, db)
}

func (s *Service) GetCall(ctx context.Context, db *gorm.DB, id uint) (*CallLog, error) {
	return s.repo.FindByID(ctx, db, id)
}
