package models

type ExternalUser struct {
	Provider       string                 `json:"provider"`
	ProviderUserID string                 `json:"provider_user_id"`
	Username       string                 `json:"username"`
	Email          string                 `json:"email"`
	Name           string                 `json:"name"`
	Groups         []string               `json:"groups,omitempty"`
	RawAttributes  map[string]interface{} `json:"raw_attributes,omitempty"`
}
