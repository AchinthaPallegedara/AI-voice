package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"voiceagent/internal/tenant"
)

// TenantResolver is satisfied by *tenant.Service.
type TenantResolver interface {
	FindByAPIKey(ctx context.Context, key string) (*tenant.Tenant, error)
}

// DBOpener is satisfied by *platform/database.TenantDBManager.
type DBOpener interface {
	GetOrOpen(t *tenant.Tenant) (*gorm.DB, error)
}

func TenantMiddleware(resolver TenantResolver, opener DBOpener) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-API-Key")
		if key == "" {
			key = c.Query("api_key")
		}
		if key == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing API key"})
			return
		}

		t, err := resolver.FindByAPIKey(c.Request.Context(), key)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid API key"})
			return
		}

		db, err := opener.GetOrOpen(t)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not open tenant database"})
			return
		}

		c.Set("tenant", t)
		c.Set("tenant_slug", t.Slug)
		c.Set("db", db)
		c.Next()
	}
}
