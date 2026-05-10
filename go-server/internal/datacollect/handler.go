package datacollect

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) GetSchema(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	fields, err := h.svc.GetSchema(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusOK, []FieldDef{})
		return
	}
	c.JSON(http.StatusOK, fields)
}

func (h *Handler) UpdateSchema(c *gin.Context) {
	var fields []FieldDef
	if err := c.ShouldBindJSON(&fields); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	if err := h.svc.UpdateSchema(c.Request.Context(), db, fields); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, fields)
}

func (h *Handler) ListRecords(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	channel := c.Query("channel")
	var from, to *time.Time
	if f := c.Query("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			from = &t
		}
	}
	if t := c.Query("to"); t != "" {
		if pt, err := time.Parse(time.RFC3339, t); err == nil {
			to = &pt
		}
	}

	records, err := h.svc.ListRecords(c.Request.Context(), db, channel, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *Handler) GetRecord(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	db := c.MustGet("db").(*gorm.DB)
	rec, err := h.svc.FindRecord(c.Request.Context(), db, uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, rec)
}

func (h *Handler) ExportCSV(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	data, err := h.svc.ExportCSV(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="collected-data.csv"`)
	c.Data(http.StatusOK, "text/csv", data)
}
