package calllog

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"voiceagent/internal/tenant"
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
	if key, ok := parseR2AudioPath(log.AudioPath); ok && h.svc.audioStore != nil {
		reader, err := h.svc.audioStore.Open(c.Request.Context(), key)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "audio not available"})
			return
		}
		defer reader.Close()
		c.DataFromReader(http.StatusOK, -1, "audio/wav", reader, map[string]string{
			"Content-Disposition": `inline; filename="recording.wav"`,
		})
		return
	}
	c.Header("Content-Type", "audio/wav")
	c.Header("Content-Disposition", `inline; filename="recording.wav"`)
	c.File(log.AudioPath)
}

func (h *Handler) GetUsage(c *gin.Context) {
	t := c.MustGet("tenant").(*tenant.Tenant)
	db := c.MustGet("db").(*gorm.DB)
	stats, err := h.svc.GetUsage(c.Request.Context(), db, t.Plan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func parseR2AudioPath(audioPath string) (string, bool) {
	const prefix = "r2://"
	if !strings.HasPrefix(audioPath, prefix) {
		return "", false
	}
	return strings.TrimPrefix(audioPath, prefix), true
}
