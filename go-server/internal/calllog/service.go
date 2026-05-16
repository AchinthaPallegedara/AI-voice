package calllog

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	repo          Repository
	recordingsDir string
	audioStore    AudioStore
}

func NewService(repo Repository, recordingsDir string, audioStore AudioStore) *Service {
	return &Service{repo: repo, recordingsDir: recordingsDir, audioStore: audioStore}
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
	userPCM []byte,
	aiChunks []TimedChunk,
	transcript string,
) error {
	cl, err := s.repo.FindByID(ctx, db, id)
	if err != nil {
		cl = &CallLog{}
	}
	cl.StartedAt = startedAt
	cl.EndedAt = endedAt
	cl.DurationSecs = int(endedAt.Sub(startedAt).Seconds())
	cl.Transcript = transcript
	cl.Status = "completed"

	if len(userPCM) > 0 || len(aiChunks) > 0 {
		if audioPath, audioErr := s.persistAudio(ctx, tenantSlug, cl.ID, userPCM, aiChunks); audioErr == nil && audioPath != "" {
			cl.AudioPath = audioPath
		} else if audioErr != nil {
			log.Printf("calllog: persist audio: %v", audioErr)
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
	userPCM []byte,
	aiChunks []TimedChunk,
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

	if len(userPCM) > 0 || len(aiChunks) > 0 {
		if audioPath, audioErr := s.persistAudio(ctx, tenantSlug, cl.ID, userPCM, aiChunks); audioErr == nil && audioPath != "" {
			cl.AudioPath = audioPath
			_ = s.repo.Update(ctx, db, cl)
		} else if audioErr != nil {
			log.Printf("calllog: persist audio: %v", audioErr)
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

var planLimitMins = map[string]int64{
	"free":       60,
	"pro":        600,
	"enterprise": 3000,
}

func (s *Service) GetUsage(ctx context.Context, db *gorm.DB, plan string) (*UsageStats, error) {
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	total, err := s.repo.SumDurationSecs(ctx, db, periodStart)
	if err != nil {
		return nil, err
	}

	limitMins := planLimitMins[plan]
	if limitMins == 0 {
		limitMins = planLimitMins["free"]
	}

	return &UsageStats{
		UsedSecs:      total,
		UsedMins:      total / 60,
		Plan:          plan,
		PlanLimitMins: limitMins,
		PeriodStart:   periodStart.Format(time.RFC3339),
	}, nil
}

func (s *Service) persistAudio(ctx context.Context, tenantSlug string, callID uint, userPCM []byte, aiChunks []TimedChunk) (string, error) {
	wav, err := MixWAV(userPCM, aiChunks)
	if err != nil {
		return "", err
	}

	key := filepath.ToSlash(filepath.Join(tenantSlug, fmt.Sprintf("%d.wav", callID)))
	if s.audioStore != nil {
		if err := s.audioStore.Upload(ctx, key, "audio/wav", wav); err == nil {
			return r2AudioPath(key), nil
		} else {
			log.Printf("calllog: upload audio to r2: %v", err)
		}
	}

	path := filepath.Join(s.recordingsDir, tenantSlug, fmt.Sprintf("%d.wav", callID))
	if err := writeWAVFile(path, wav); err != nil {
		return "", err
	}
	return path, nil
}
