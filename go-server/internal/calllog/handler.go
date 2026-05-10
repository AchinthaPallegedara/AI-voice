package calllog

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	logs, err := h.svc.ListCalls(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	log, err := h.svc.GetCall(c.Request.Context(), db, uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, log)
}

func (h *Handler) ServeAudio(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	log, err := h.svc.GetCall(c.Request.Context(), db, uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if log.AudioPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "audio not available"})
		return
	}
	c.Header("Content-Type", "audio/wav")
	c.Header("Content-Disposition", `inline; filename="recording.wav"`)
	c.File(log.AudioPath)
}
