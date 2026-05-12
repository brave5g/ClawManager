package services

import (
	"errors"
	"fmt"
	"log"
	"time"

	"clawreef/internal/config"
	"clawreef/internal/models"
	"clawreef/internal/repository"
	"clawreef/internal/utils"
)

type TokenPair struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         *models.User `json:"user"`
}

type AuthService interface {
	Register(username, email, password string) (*models.User, error)
	Login(username, password string) (*TokenPair, error)
	ProviderLogin(provider string, credentials map[string]string) (*TokenPair, error)
	RefreshToken(refreshToken string) (*TokenPair, error)
	GetCurrentUser(userID int) (*models.User, error)
	ChangePassword(userID int, currentPassword, newPassword string) error
	Logout(token string) error
}

type authService struct {
	userRepo   repository.UserRepository
	jwtConfig  config.JWTConfig
	ldapConfig *config.LDAPConfig
}

type authServiceWithProviders struct {
	authService
	providers       map[string]IdentityProvider
	userSyncService UserSyncService
}

func NewAuthService(userRepo repository.UserRepository, jwtConfig config.JWTConfig, ldapConfig *config.LDAPConfig) AuthService {
	return &authService{
		userRepo:   userRepo,
		jwtConfig:  jwtConfig,
		ldapConfig: ldapConfig,
	}
}

func NewAuthServiceWithProviders(
	userRepo repository.UserRepository,
	jwtConfig config.JWTConfig,
	ldapConfig *config.LDAPConfig,
	userSyncService UserSyncService,
	providers ...IdentityProvider,
) AuthService {
	providerMap := make(map[string]IdentityProvider)
	for _, p := range providers {
		providerMap[p.ProviderName()] = p
	}
	return &authServiceWithProviders{
		authService: authService{
			userRepo:   userRepo,
			jwtConfig:  jwtConfig,
			ldapConfig: ldapConfig,
		},
		providers:       providerMap,
		userSyncService: userSyncService,
	}
}

func (s *authService) Register(username, email, password string) (*models.User, error) {
	existingUser, err := s.userRepo.GetByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}
	if existingUser != nil {
		return nil, errors.New("username already exists")
	}

	existingUser, err = s.userRepo.GetByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("failed to check email: %w", err)
	}
	if existingUser != nil {
		return nil, errors.New("email already exists")
	}

	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		Username:     username,
		Email:        email,
		PasswordHash: passwordHash,
		Role:         "user",
		IsActive:     true,
		Source:       "local",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *authService) Login(username, password string) (*TokenPair, error) {
	user, err := s.userRepo.GetByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		user, err = s.userRepo.GetByEmail(username)
		if err != nil {
			return nil, fmt.Errorf("failed to get user: %w", err)
		}
	}

	if user == nil {
		return nil, errors.New("invalid username or password")
	}

	if !user.IsActive {
		return nil, errors.New("account is disabled")
	}

	if user.Source != "" && user.Source != "local" {
		return nil, fmt.Errorf("please use %s authentication to login", user.Source)
	}

	if !utils.VerifyPassword(password, user.PasswordHash) {
		return nil, errors.New("invalid username or password")
	}

	return s.generateTokens(user.ID)
}

func (s *authService) ProviderLogin(provider string, credentials map[string]string) (*TokenPair, error) {
	log.Printf("Provider authentication attempted but not enabled: %s", provider)
	return nil, fmt.Errorf("provider authentication is not enabled")
}

func (s *authServiceWithProviders) ProviderLogin(provider string, credentials map[string]string) (*TokenPair, error) {
	providerService, ok := s.providers[provider]
	if !ok {
		return nil, fmt.Errorf("provider '%s' is not configured", provider)
	}

	if !providerService.IsEnabled() {
		return nil, fmt.Errorf("provider '%s' is not enabled", provider)
	}

	externalUser, err := providerService.Authenticate(credentials)
	if err != nil {
		return nil, err
	}

	user, err := s.userSyncService.SyncUser(provider, externalUser)
	if err != nil {
		return nil, err
	}

	if !user.IsActive {
		return nil, errors.New("account is disabled")
	}

	if user.ApprovalStatus == models.UserStatusPending {
		return nil, errors.New("PENDING_APPROVAL:account is pending approval. please wait for administrator to approve your account")
	}

	if user.ApprovalStatus == models.UserStatusRejected {
		return nil, errors.New("account has been rejected. please contact administrator")
	}

	now := time.Now()
	user.LastLogin = &now
	if err := s.userRepo.Update(user); err != nil {
		return nil, fmt.Errorf("failed to update last login time: %w", err)
	}

	tokenPair, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return tokenPair, nil
}

func (s *authService) RefreshToken(refreshToken string) (*TokenPair, error) {
	claims, err := utils.ValidateToken(refreshToken, s.jwtConfig.Secret)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	if claims.TokenType != "refresh" {
		return nil, errors.New("invalid token type")
	}

	user, err := s.userRepo.GetByID(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if !user.IsActive {
		return nil, errors.New("account is disabled")
	}

	return s.generateTokens(user.ID)
}

func (s *authService) GetCurrentUser(userID int) (*models.User, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (s *authService) ChangePassword(userID int, currentPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return errors.New("user not found")
	}

	if !utils.VerifyPassword(currentPassword, user.PasswordHash) {
		return errors.New("current password is incorrect")
	}

	passwordHash, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.PasswordHash = passwordHash
	user.UpdatedAt = time.Now()
	if err := s.userRepo.Update(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

func (s *authService) Logout(token string) error {
	return nil
}

func (s *authService) generateTokens(userID int) (*TokenPair, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	accessToken, err := utils.GenerateToken(
		utils.TokenClaims{
			UserID:    userID,
			TokenType: "access",
		},
		s.jwtConfig.Secret,
		time.Duration(s.jwtConfig.AccessExpiry)*time.Minute,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := utils.GenerateToken(
		utils.TokenClaims{
			UserID:    userID,
			TokenType: "refresh",
		},
		s.jwtConfig.Secret,
		time.Duration(s.jwtConfig.RefreshExpiry)*time.Minute,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}
