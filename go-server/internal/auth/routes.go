package auth

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.POST("/auth/register", h.Register)
	rg.POST("/auth/login", h.Login)
}
