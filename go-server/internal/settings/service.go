package settings

import (
	"context"

	"gorm.io/gorm"
)

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context, db *gorm.DB) (*Settings, error) {
	return s.repo.Get(ctx, db)
}

func (s *Service) Update(ctx context.Context, db *gorm.DB, in *Settings) (*Settings, error) {
	in.ApplyDefaults()
	if err := s.repo.Upsert(ctx, db, in); err != nil {
		return nil, err
	}
	return s.repo.Get(ctx, db)
}

func (s *Service) GetForCall(ctx context.Context, db *gorm.DB) (systemPrompt, voice, greeting, language string, err error) {
	settings, err := s.repo.Get(ctx, db)
	if err != nil {
		return
	}
	resolvedGreeting := settings.ResolveGreeting()
	prompt := settings.ResolvePrompt()

	if resolvedGreeting != "" {
		prompt += "\n\nWhen this call begins, your very first words must be exactly: \"" + resolvedGreeting + "\". Do not change or paraphrase this opening line."
	}

	// Language instruction
	switch settings.Language {
	case "auto", "":
		prompt += "\n\nDetect the language the caller is speaking from their very first words and respond entirely in that same language for the rest of the call. Never switch languages unless the caller switches first."
	case "en":
		// no extra instruction needed
	default:
		prompt += "\n\nAlways respond in " + languageName(settings.Language) + ". Never switch to another language."
	}

	// Business context restriction — always enforced server-side
	if settings.BusinessName != "" || settings.BusinessDescription != "" || settings.AgentGoal != "" {
		business := settings.BusinessName
		if business == "" {
			business = "this business"
		}
		prompt += "\n\nCRITICAL RULE: You may ONLY discuss topics directly related to " + business + " and its services. If the caller asks about anything unrelated — such as general knowledge, personal advice, other companies, or off-topic subjects — you must refuse and say: \"I can only help with questions about " + business + ". Is there something related to our services I can assist you with?\" Do not make exceptions."
	}

	return prompt, settings.Voice, resolvedGreeting, settings.Language, nil
}

func languageName(code string) string {
	names := map[string]string{
		"si": "Sinhala",
		"es": "Spanish",
		"fr": "French",
		"de": "German",
		"pt": "Portuguese",
		"ja": "Japanese",
		"zh": "Chinese",
		"ar": "Arabic",
		"hi": "Hindi",
		"ko": "Korean",
		"it": "Italian",
	}
	if n, ok := names[code]; ok {
		return n
	}
	return code
}
