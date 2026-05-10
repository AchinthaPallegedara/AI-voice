package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"voiceagent/internal/tenant"
	"voiceagent/internal/user"
)

type Handler struct {
	tenantSvc *tenant.Service
	userSvc   *user.Service
}

func NewHandler(tenantSvc *tenant.Service, userSvc *user.Service) *Handler {
	return &Handler{tenantSvc: tenantSvc, userSvc: userSvc}
}

func (h *Handler) Register(c *gin.Context) {
	var body struct {
		Name     string `json:"name"     binding:"required"`
		Slug     string `json:"slug"     binding:"required"`
		Email    string `json:"email"    binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	body.Slug = strings.ToLower(strings.ReplaceAll(body.Slug, " ", "-"))

	t, err := h.tenantSvc.Create(c.Request.Context(), body.Name, body.Slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account: " + err.Error()})
		return
	}

	if err := h.userSvc.Create(c.Request.Context(), t.ID, body.Email, body.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"api_key": t.APIKey,
		"slug":    t.Slug,
		"name":    t.Name,
	})
}

func (h *Handler) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"    binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, err := h.userSvc.Authenticate(c.Request.Context(), body.Email, body.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	t, err := h.tenantSvc.FindByID(c.Request.Context(), u.TenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"api_key": t.APIKey,
		"slug":    t.Slug,
		"name":    t.Name,
	})
}
