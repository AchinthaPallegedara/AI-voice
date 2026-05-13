package whatsapp

import "github.com/gin-gonic/gin"

func RegisterRoutes(secured *gin.RouterGroup, h *Handler) {
	g := secured.Group("/whatsapp-channel")
	g.GET("", h.GetChannel)
	g.POST("", h.SaveChannel)
	g.DELETE("", h.DeleteChannel)
	g.GET("/oauth/url", h.OAuthURL)
	g.POST("/oauth/exchange", h.OAuthExchange)
}

func RegisterWebhookRoutes(webhooks *gin.RouterGroup, h *Handler) {
	webhooks.GET("/whatsapp/:apiKey", h.WebhookVerify)
	webhooks.POST("/whatsapp/:apiKey", h.WebhookReceive)
}
