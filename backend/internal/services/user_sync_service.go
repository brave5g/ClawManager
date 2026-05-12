package services

import (
	"fmt"
	"time"

	"clawreef/internal/models"
	"clawreef/internal/repository"
)

type AutoCreateChecker func(providerName string) bool

type userSyncService struct {
	userRepo       repository.UserRepository
	quotaRepo      repository.QuotaRepository
	autoCreateFunc AutoCreateChecker
}

func NewUserSyncService(userRepo repository.UserRepository, quotaRepo repository.QuotaRepository, autoCreateFunc AutoCreateChecker) UserSyncService {
	return &userSyncService{
		userRepo:       userRepo,
		quotaRepo:      quotaRepo,
		autoCreateFunc: autoCreateFunc,
	}
}

func (s *userSyncService) SyncUser(providerName string, externalUser *models.ExternalUser) (*models.User, error) {
	user, err := s.userRepo.GetByUsername(externalUser.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}

	if user == nil {
		if s.autoCreateFunc != nil && !s.autoCreateFunc(providerName) {
			return s.createPendingExternalUser(providerName, externalUser)
		}
		return s.createNewExternalUser(providerName, externalUser)
	}

	return s.updateExistingExternalUser(user, providerName, externalUser)
}

func (s *userSyncService) createNewExternalUser(providerName string, externalUser *models.ExternalUser) (*models.User, error) {
	role := "user"
	for _, group := range externalUser.Groups {
		if group == "admin" {
			role = "admin"
			break
		}
	}

	// Users reaching this point have passed the auto-create check
	// so they should be created as approved and active
	user := &models.User{
		Username:       externalUser.Username,
		Email:          externalUser.Email,
		PasswordHash:   "",
		Role:           role,
		IsActive:       true,
		Source:         providerName,
		ApprovalStatus: models.UserStatusApproved,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	if _, err := s.quotaRepo.CreateDefaultQuota(user.ID); err != nil {
		return nil, fmt.Errorf("failed to create default quota: %w", err)
	}

	return user, nil
}

func (s *userSyncService) createPendingExternalUser(providerName string, externalUser *models.ExternalUser) (*models.User, error) {
	role := "user"
	for _, group := range externalUser.Groups {
		if group == "admin" {
			role = "admin"
			break
		}
	}

	user := &models.User{
		Username:       externalUser.Username,
		Email:          externalUser.Email,
		PasswordHash:   "",
		Role:           role,
		IsActive:       false,
		Source:         providerName,
		ApprovalStatus: models.UserStatusPending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	if _, err := s.quotaRepo.CreateDefaultQuota(user.ID); err != nil {
		return nil, fmt.Errorf("failed to create default quota: %w", err)
	}

	return user, nil
}

func (s *userSyncService) updateExistingExternalUser(user *models.User, providerName string, externalUser *models.ExternalUser) (*models.User, error) {
	if user.Source != providerName {
		user.Source = providerName
	}

	if user.ApprovalStatus == models.UserStatusRejected {
		return nil, fmt.Errorf("account has been rejected")
	}

	if user.ApprovalStatus == models.UserStatusPending {
		if user.Email != externalUser.Email && externalUser.Email != "" {
			user.Email = externalUser.Email
		}
		user.UpdatedAt = time.Now()
		if err := s.userRepo.Update(user); err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
		return user, nil
	}

	needsUpdate := false

	if user.Email != externalUser.Email && externalUser.Email != "" {
		user.Email = externalUser.Email
		needsUpdate = true
	}

	// Activate user if approved but not active
	if user.ApprovalStatus == models.UserStatusApproved && !user.IsActive {
		user.IsActive = true
		needsUpdate = true
	}

	for _, group := range externalUser.Groups {
		if group == "admin" && user.Role != "admin" {
			user.Role = "admin"
			needsUpdate = true
			break
		}
	}

	if needsUpdate || user.LastLogin == nil {
		now := time.Now()
		user.LastLogin = &now
		needsUpdate = true
	}

	if needsUpdate {
		user.UpdatedAt = time.Now()
		if err := s.userRepo.Update(user); err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	return user, nil
}

func (s *userSyncService) LinkExternalAccount(userID int, providerName string, providerUserID string) error {
	return nil
}

func (s *userSyncService) UnlinkExternalAccount(userID int, providerName string) error {
	return nil
}

func (s *userSyncService) GetLinkedProviders(userID int) ([]string, error) {
	return []string{}, nil
}
