package handlers

import (
	"log"
	"net/http"

	"clawreef/internal/services"
	"clawreef/internal/utils"

	"github.com/gin-gonic/gin"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	authService         services.AuthService
	systemConfigService services.SystemConfigService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService services.AuthService, systemConfigService services.SystemConfigService) *AuthHandler {
	return &AuthHandler{
		authService:         authService,
		systemConfigService: systemConfigService,
	}
}

// LoginProvider represents a login provider configuration
type LoginProvider struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Enabled bool   `json:"enabled"`
	Icon    string `json:"icon,omitempty"`
	Label   string `json:"label,omitempty"`
}

// LoginConfig represents public login configuration
type LoginConfig struct {
	Providers                 []LoginProvider `json:"providers"`
	AllowUsernameOrEmailLogin bool            `json:"allow_username_or_email_login"`
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=32,alphanum"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	user, err := h.authService.Register(req.Username, req.Email, req.Password)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusCreated, "User registered successfully", user)
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	tokenPair, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "Login successful", tokenPair)
}

// GetLoginConfig returns public login configuration for the login page
func (h *AuthHandler) GetLoginConfig(c *gin.Context) {
	ldapCfg, err := h.systemConfigService.GetLDAPConfig()
	if err != nil {
		log.Printf("Failed to get LDAP config: %v", err)
		// Fallback to only local login on error
		utils.Success(c, http.StatusOK, "Login config retrieved successfully", LoginConfig{
			Providers: []LoginProvider{
				{
					ID:      "local",
					Name:    "Local",
					Type:    "local",
					Enabled: true,
				},
			},
			AllowUsernameOrEmailLogin: true,
		})
		return
	}

	providers := []LoginProvider{}

	providers = append(providers, LoginProvider{
		ID:      "local",
		Name:    "Local",
		Type:    "local",
		Enabled: true,
	})

	if ldapCfg.Enabled {
		providers = append(providers, LoginProvider{
			ID:      "ldap",
			Name:    "LDAP",
			Type:    "ldap",
			Enabled: true,
		})
	}

	// Ensure at least one login method is available
	if len(providers) == 0 {
		providers = append(providers, LoginProvider{
			ID:      "local",
			Name:    "Local",
			Type:    "local",
			Enabled: true,
		})
	}

	utils.Success(c, http.StatusOK, "Login config retrieved successfully", LoginConfig{
		Providers:                 providers,
		AllowUsernameOrEmailLogin: ldapCfg.AllowUsernameOrEmailLogin,
	})
}

// LDAPLogin handles LDAP user login
func (h *AuthHandler) LDAPLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	credentials := map[string]string{
		"username": req.Username,
		"password": req.Password,
	}

	tokenPair, err := h.authService.ProviderLogin(services.ProviderNameLDAP, credentials)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "LDAP login successful", tokenPair)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	tokenPair, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "Token refreshed successfully", tokenPair)
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// In a stateless JWT system, logout is handled client-side
	// by removing the token from storage
	utils.Success(c, http.StatusOK, "Logout successful", nil)
}

// GetCurrentUser gets the current authenticated user
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		utils.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.authService.GetCurrentUser(userID.(int))
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "User retrieved successfully", user)
}

// ChangePassword changes the current user's password
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		utils.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	if err := h.authService.ChangePassword(userID.(int), req.CurrentPassword, req.NewPassword); err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "Password changed successfully", nil)
}
