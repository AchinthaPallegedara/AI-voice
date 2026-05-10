package settings

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.GET("/settings", h.Get)
	rg.POST("/settings", h.Update)
	rg.GET("/settings/preview-voice", h.PreviewVoice)
}
