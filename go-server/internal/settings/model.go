package settings

import (
	"strings"

	"gorm.io/gorm"
)

type Settings struct {
	gorm.Model             `json:"-"`
	AIName                 string `gorm:"not null;default:'Aria'"  json:"ai_name"`
	Voice                  string `gorm:"not null;default:'Puck'"  json:"voice"`
	Greeting               string `gorm:"not null;type:text"       json:"greeting"`
	BusinessName           string `gorm:"default:''"               json:"business_name"`
	BusinessDescription    string `gorm:"type:text;default:''"     json:"business_description"`
	AgentGoal              string `gorm:"type:text;default:''"     json:"agent_goal"`
	SystemPrompt           string `gorm:"not null;type:text"       json:"system_prompt"`
	Timezone               string `gorm:"default:'UTC'"            json:"timezone"`
	Language               string `gorm:"default:'en'"             json:"language"`
	MaxCallDurationSecs    int    `gorm:"default:0"                json:"max_call_duration_secs"`
	DataCollectionEnabled  bool   `gorm:"default:false"            json:"data_collection_enabled"`
}

func (s *Settings) ApplyDefaults() {
	if s.AIName == "" {
		s.AIName = "Aria"
	}
	if s.Voice == "" {
		s.Voice = "Puck"
	}
	if s.Greeting == "" {
		s.Greeting = "Hey! I'm {ai_name}. How can I help you today?"
	}
	if s.SystemPrompt == "" {
		s.SystemPrompt = "You are {ai_name}, a friendly and helpful voice assistant. You are in a live voice call — respond only with natural spoken words. Keep every reply to 1-3 short sentences. Never use markdown, lists, or special formatting."
	}
}

func (s Settings) ResolvePrompt() string {
	var b strings.Builder

	if s.BusinessName != "" {
		b.WriteString("Business: " + s.BusinessName + "\n")
	}
	if s.BusinessDescription != "" {
		b.WriteString("About the business: " + s.BusinessDescription + "\n")
	}
	if s.AgentGoal != "" {
		b.WriteString("Your goal on this call: " + s.AgentGoal + "\n")
	}
	if b.Len() > 0 {
		b.WriteString("\n")
	}
	b.WriteString(s.SystemPrompt)

	out := b.String()
	out = strings.ReplaceAll(out, "{ai_name}", s.AIName)
	out = strings.ReplaceAll(out, "{name}", s.AIName)
	return out
}

func (s Settings) ResolveGreeting() string {
	g := s.Greeting
	g = strings.ReplaceAll(g, "{ai_name}", s.AIName)
	g = strings.ReplaceAll(g, "{name}", s.AIName)
	return g
}
