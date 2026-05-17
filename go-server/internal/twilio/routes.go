package twilio

import "github.com/gin-gonic/gin"

func RegisterRoutes(secured *gin.RouterGroup, h *Handler) {
	g := secured.Group("/twilio-channel")
	g.GET("", h.GetChannel)
	g.POST("", h.SaveChannel)
	g.DELETE("", h.DeleteChannel)
}

func RegisterWebhookRoutes(webhooks *gin.RouterGroup, h *Handler) {
	webhooks.POST("/twilio/:apiKey/voice", h.VoiceWebhook)
	webhooks.GET("/twilio/:apiKey/stream", h.MediaStream)
}
