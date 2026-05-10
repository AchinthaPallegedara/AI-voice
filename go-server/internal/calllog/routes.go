package calllog

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.GET("/calls", h.List)
	rg.GET("/calls/:id", h.Get)
	rg.GET("/calls/:id/audio", h.ServeAudio)
}
