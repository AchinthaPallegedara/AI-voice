package tenant

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// TenantProvisioner is satisfied by *platform/database.TenantDBManager.
type TenantProvisioner interface {
	Provision(ctx context.Context, t *Tenant) error
}

type Service struct {
	repo Repository
	mgr  TenantProvisioner
}

func NewService(repo Repository, mgr TenantProvisioner) *Service {
	return &Service{repo: repo, mgr: mgr}
}

func (s *Service) Create(ctx context.Context, name, slug string) (*Tenant, error) {
	apiKey, err := generateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("generate api key: %w", err)
	}

	t := &Tenant{
		Slug:   slug,
		Name:   name,
		APIKey: apiKey,
	}

	if err := s.mgr.Provision(ctx, t); err != nil {
		return nil, fmt.Errorf("provision tenant db: %w", err)
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, fmt.Errorf("save tenant: %w", err)
	}
	return t, nil
}

func (s *Service) FindByAPIKey(ctx context.Context, key string) (*Tenant, error) {
	return s.repo.FindByAPIKey(ctx, key)
}

func (s *Service) FindByID(ctx context.Context, id uint) (*Tenant, error) {
	return s.repo.FindByID(ctx, id)
}

func generateAPIKey() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "va_" + hex.EncodeToString(b), nil
}
