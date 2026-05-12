package services

import (
	"clawreef/internal/models"
)

type ProviderConfig interface {
	IsEnabled() bool
	GetProviderName() string
}

type IdentityProvider interface {
	ProviderName() string
	Authenticate(credentials map[string]string) (*models.ExternalUser, error)
	IsEnabled() bool
	GetProviderConfig() ProviderConfig
}

type UserSyncService interface {
	SyncUser(providerName string, externalUser *models.ExternalUser) (*models.User, error)
	LinkExternalAccount(userID int, providerName string, providerUserID string) error
	UnlinkExternalAccount(userID int, providerName string) error
	GetLinkedProviders(userID int) ([]string, error)
}
