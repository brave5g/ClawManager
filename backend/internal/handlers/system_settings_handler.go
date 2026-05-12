package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"clawreef/internal/models"
	"clawreef/internal/services"
	"clawreef/internal/utils"

	"github.com/gin-gonic/gin"
)

type SystemSettingsHandler struct {
	systemImageSettingService services.SystemImageSettingService
	systemConfigService       services.SystemConfigService
}

type UpsertSystemImageSettingRequest struct {
	ID           int    `json:"id,omitempty"`
	InstanceType string `json:"instance_type" binding:"required"`
	DisplayName  string `json:"display_name"`
	Image        string `json:"image" binding:"required"`
}

type LDAPConfigRequest struct {
	Enabled                   bool   `json:"enabled"`
	Host                      string `json:"host"`
	Port                      int    `json:"port"`
	UseSSL                    bool   `json:"use_ssl"`
	InsecureSkipVerify        bool   `json:"insecure_skip_verify"`
	BaseDN                    string `json:"base_dn"`
	BindDN                    string `json:"bind_dn"`
	BindPassword              string `json:"bind_password"`
	UserSearchFilter          string `json:"user_search_filter"`
	UserSearchBaseDN          string `json:"user_search_base_dn"`
	UsernameAttribute         string `json:"username_attribute"`
	EmailAttribute            string `json:"email_attribute"`
	NameAttribute             string `json:"name_attribute"`
	LDAPFilter                string `json:"ldap_filter"`
	AllowUsernameOrEmailLogin bool   `json:"allow_username_or_email_login"`
	AutoCreateUser            bool   `json:"auto_create_user"`
	GroupBaseDN               string `json:"group_base_dn"`
	AdminGroup                string `json:"admin_group"`
}

func NewSystemSettingsHandler(systemImageSettingService services.SystemImageSettingService, systemConfigService services.SystemConfigService) *SystemSettingsHandler {
	return &SystemSettingsHandler{
		systemImageSettingService: systemImageSettingService,
		systemConfigService:       systemConfigService,
	}
}

func (h *SystemSettingsHandler) ListSystemImageSettings(c *gin.Context) {
	settings, err := h.systemImageSettingService.List()
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "System image settings retrieved successfully", gin.H{
		"items": settings,
	})
}

func (h *SystemSettingsHandler) UpsertSystemImageSetting(c *gin.Context) {
	var req UpsertSystemImageSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	setting := &models.SystemImageSetting{
		ID:           req.ID,
		InstanceType: strings.TrimSpace(req.InstanceType),
		DisplayName:  strings.TrimSpace(req.DisplayName),
		Image:        strings.TrimSpace(req.Image),
	}

	saved, err := h.systemImageSettingService.Save(setting)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "System image setting saved successfully", saved)
}

func (h *SystemSettingsHandler) DeleteSystemImageSetting(c *gin.Context) {
	target := strings.TrimSpace(c.Param("instanceType"))
	if id, err := strconv.Atoi(target); err == nil {
		if err := h.systemImageSettingService.DeleteByID(id); err != nil {
			utils.HandleError(c, err)
			return
		}
	} else {
		if err := h.systemImageSettingService.DisableType(target); err != nil {
			utils.HandleError(c, err)
			return
		}
	}

	utils.Success(c, http.StatusOK, "System image setting deleted successfully", nil)
}

func (h *SystemSettingsHandler) GetLDAPConfig(c *gin.Context) {
	cfg, err := h.systemConfigService.GetLDAPConfig()
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "LDAP config retrieved successfully", cfg)
}

func (h *SystemSettingsHandler) SaveLDAPConfig(c *gin.Context) {
	var req LDAPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	ldapCfg := &models.LDAPConfig{
		Enabled:                   req.Enabled,
		Host:                      req.Host,
		Port:                      req.Port,
		UseSSL:                    req.UseSSL,
		InsecureSkipVerify:        req.InsecureSkipVerify,
		BaseDN:                    req.BaseDN,
		BindDN:                    req.BindDN,
		BindPassword:              req.BindPassword,
		UserSearchFilter:          req.UserSearchFilter,
		UserSearchBaseDN:          req.UserSearchBaseDN,
		UsernameAttribute:         req.UsernameAttribute,
		EmailAttribute:            req.EmailAttribute,
		NameAttribute:             req.NameAttribute,
		LDAPFilter:                req.LDAPFilter,
		AllowUsernameOrEmailLogin: req.AllowUsernameOrEmailLogin,
		AutoCreateUser:            req.AutoCreateUser,
		GroupBaseDN:               req.GroupBaseDN,
		AdminGroup:                req.AdminGroup,
	}

	if err := h.systemConfigService.SaveLDAPConfig(ldapCfg); err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "LDAP config saved successfully", nil)
}

func (h *SystemSettingsHandler) TestLDAPConnection(c *gin.Context) {
	var req LDAPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationError(c, err)
		return
	}

	ldapCfg := &models.LDAPConfig{
		Enabled:                   req.Enabled,
		Host:                      req.Host,
		Port:                      req.Port,
		UseSSL:                    req.UseSSL,
		InsecureSkipVerify:        req.InsecureSkipVerify,
		BaseDN:                    req.BaseDN,
		BindDN:                    req.BindDN,
		BindPassword:              req.BindPassword,
		UserSearchFilter:          req.UserSearchFilter,
		UserSearchBaseDN:          req.UserSearchBaseDN,
		UsernameAttribute:         req.UsernameAttribute,
		EmailAttribute:            req.EmailAttribute,
		NameAttribute:             req.NameAttribute,
		LDAPFilter:                req.LDAPFilter,
		AllowUsernameOrEmailLogin: req.AllowUsernameOrEmailLogin,
		AutoCreateUser:            req.AutoCreateUser,
		GroupBaseDN:               req.GroupBaseDN,
		AdminGroup:                req.AdminGroup,
	}

	_, err := h.systemConfigService.TestLDAPConnection(ldapCfg)
	if err != nil {
		utils.Success(c, http.StatusOK, "LDAP connection test failed", gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	utils.Success(c, http.StatusOK, "LDAP connection test successful", gin.H{
		"success": true,
	})
}

func (h *SystemSettingsHandler) GetAllConfigs(c *gin.Context) {
	configs, err := h.systemConfigService.GetAllConfigs()
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	utils.Success(c, http.StatusOK, "Configs retrieved successfully", gin.H{
		"items": configs,
	})
}
