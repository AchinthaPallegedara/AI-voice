package telegram

import "github.com/gin-gonic/gin"

func RegisterRoutes(secured *gin.RouterGroup, h *Handler) {
	g := secured.Group("/telegram-channel")
	g.GET("", h.GetChannel)
	g.POST("/setup", h.Setup)
	g.DELETE("", h.DeleteChannel)
}

func RegisterWebhookRoutes(webhooks *gin.RouterGroup, h *Handler) {
	webhooks.POST("/telegram/:apiKey", h.WebhookReceive)
}
