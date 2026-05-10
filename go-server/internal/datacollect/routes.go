package datacollect

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.GET("/data-schema", h.GetSchema)
	rg.PUT("/data-schema", h.UpdateSchema)
	rg.GET("/collected-data", h.ListRecords)
	rg.GET("/collected-data/:id", h.GetRecord)
	rg.GET("/collected-data/export", h.ExportCSV)
}
