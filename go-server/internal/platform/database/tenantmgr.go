package database

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"voiceagent/internal/calllog"
	"voiceagent/internal/connector"
	"voiceagent/internal/datacollect"
	"voiceagent/internal/knowledge"
	"voiceagent/internal/settings"
	"voiceagent/internal/tenant"
	"voiceagent/internal/telegram"
	"voiceagent/internal/twilio"
	"voiceagent/internal/whatsapp"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type TenantDBManager struct {
	mu      sync.RWMutex
	conns   map[uint]*gorm.DB
	baseDSN string // e.g. "postgres://user:pass@host:5432/"
}

func NewTenantDBManager(baseDSN string) *TenantDBManager {
	return &TenantDBManager{
		conns:   make(map[uint]*gorm.DB),
		baseDSN: baseDSN,
	}
}

// Provision creates the tenant's database, migrates schema, and seeds default settings.
// It also sets t.DatabaseURL so the caller can persist it.
func (m *TenantDBManager) Provision(ctx context.Context, t *tenant.Tenant) error {
	dbName := dbNameForSlug(t.Slug)
	dsn := m.baseDSN + "postgres?sslmode=disable"

	// Connect to the maintenance "postgres" DB to issue CREATE DATABASE
	adminDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		return fmt.Errorf("connect to postgres admin: %w", err)
	}
	sqlDB, _ := adminDB.DB()
	defer sqlDB.Close()

	// Create database — safe to run even if it already exists
	if _, err := sqlDB.ExecContext(ctx, fmt.Sprintf(`CREATE DATABASE "%s"`, dbName)); err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("create database: %w", err)
		}
	}

	tenantDSN := m.tenantDSN(dbName)
	t.DatabaseURL = tenantDSN

	db, err := m.openAndMigrate(tenantDSN)
	if err != nil {
		return err
	}

	// Seed default settings row (id=1)
	defaults := &settings.Settings{}
	defaults.ID = 1
	defaults.ApplyDefaults()
	if err := db.WithContext(ctx).
		Where(settings.Settings{}).
		FirstOrCreate(defaults).Error; err != nil {
		return fmt.Errorf("seed settings: %w", err)
	}

	m.mu.Lock()
	m.conns[t.ID] = db
	m.mu.Unlock()
	return nil
}

// GetOrOpen returns a cached GORM connection for the tenant, or opens one.
func (m *TenantDBManager) GetOrOpen(t *tenant.Tenant) (*gorm.DB, error) {
	m.mu.RLock()
	db, ok := m.conns[t.ID]
	m.mu.RUnlock()
	if ok {
		return db, nil
	}

	db, err := m.openAndMigrate(t.DatabaseURL)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.conns[t.ID] = db
	m.mu.Unlock()
	return db, nil
}

func (m *TenantDBManager) openAndMigrate(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open tenant db: %w", err)
	}
	if err := db.AutoMigrate(
		&settings.Settings{},
		&calllog.CallLog{},
		&knowledge.KnowledgeEntry{},
		&connector.APIConnector{},
		&datacollect.CollectedDataSchema{},
		&datacollect.CollectedRecord{},
		&whatsapp.Channel{},
		&telegram.Channel{},
		&twilio.Channel{},
	); err != nil && !strings.Contains(err.Error(), "already exists") {
		return nil, fmt.Errorf("migrate tenant db: %w", err)
	}
	return db, nil
}

func (m *TenantDBManager) tenantDSN(dbName string) string {
	// baseDSN ends with "/" — append db name + sslmode
	return m.baseDSN + dbName + "?sslmode=disable"
}

func dbNameForSlug(slug string) string {
	return "voiceagent_" + strings.ReplaceAll(slug, "-", "_")
}
