package main

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"voiceagent/internal/auth"
	"voiceagent/internal/call"
	"voiceagent/internal/calllog"
	"voiceagent/internal/config"
	"voiceagent/internal/connector"
	"voiceagent/internal/datacollect"
	"voiceagent/internal/knowledge"
	"voiceagent/internal/platform/database"
	"voiceagent/internal/platform/middleware"
	"voiceagent/internal/settings"
	"voiceagent/internal/tenant"
	"voiceagent/internal/user"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Control plane DB (tenant + user registry)
	controlDB, err := database.Open(cfg.ControlPlaneDBURL)
	if err != nil {
		log.Fatalf("control plane db: %v", err)
	}

	// Per-tenant DB manager
	mgr := database.NewTenantDBManager(cfg.PostgresBaseDSN)

	// Tenant domain
	tenantRepo := tenant.NewRepository(controlDB)
	tenantSvc := tenant.NewService(tenantRepo, mgr)
	tenantHandler := tenant.NewHandler(tenantSvc)

	// User domain
	userRepo := user.NewRepository(controlDB)
	userSvc := user.NewService(userRepo)

	// Auth domain
	authHandler := auth.NewHandler(tenantSvc, userSvc)

	// Settings domain
	settingsRepo := settings.NewRepository()
	settingsSvc := settings.NewService(settingsRepo)
	settingsHandler := settings.NewHandler(settingsSvc)

	// Knowledge domain
	knowledgeSvc := knowledge.NewService(knowledge.NewRepository())
	knowledgeHandler := knowledge.NewHandler(knowledgeSvc)

	// Connector domain
	connectorSvc := connector.NewService(connector.NewRepository())
	connectorHandler := connector.NewHandler(connectorSvc)

	// Data collection domain
	datacollectSvc := datacollect.NewService(datacollect.NewRepository())
	datacollectHandler := datacollect.NewHandler(datacollectSvc)

	// Call log domain
	callLogSvc := calllog.NewService(calllog.NewRepository(), cfg.RecordingsDir)
	callLogHandler := calllog.NewHandler(callLogSvc)

	// Call domain (now wired with all services)
	callHandler := call.NewHandler(settingsSvc, knowledgeSvc, connectorSvc, datacollectSvc, callLogSvc, cfg.GeminiAPIKey, cfg.GeminiModel)

	// Tenant middleware
	tenantMW := middleware.TenantMiddleware(tenantSvc, mgr)

	// Router
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-API-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public endpoints
	api := r.Group("/api")
	tenant.RegisterRoutes(api, tenantHandler)
	auth.RegisterRoutes(api, authHandler)

	// Tenant-scoped endpoints
	secured := r.Group("/")
	secured.Use(tenantMW)
	settings.RegisterRoutes(secured.Group("/api"), settingsHandler)
	call.RegisterRoutes(secured, callHandler)
	calllog.RegisterRoutes(secured.Group("/api"), callLogHandler)
	knowledge.RegisterRoutes(secured.Group("/api"), knowledgeHandler)
	connector.RegisterRoutes(secured.Group("/api"), connectorHandler)
	datacollect.RegisterRoutes(secured.Group("/api"), datacollectHandler)

	log.Printf("listening on %s", cfg.HTTPAddr)
	if err := r.Run(cfg.HTTPAddr); err != nil {
		log.Fatalf("server: %v", err)
	}
}
