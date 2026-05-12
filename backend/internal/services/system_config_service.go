package services

import (
	"fmt"
	"log"
	"strings"

	"clawreef/internal/config"
	"clawreef/internal/models"
	"clawreef/internal/repository"
	"clawreef/internal/utils"
)

type SystemConfigService interface {
	GetLDAPConfig() (*models.LDAPConfig, error)
	SaveLDAPConfig(cfg *models.LDAPConfig) error
	TestLDAPConnection(cfg *models.LDAPConfig) (bool, error)
	GetAllConfigs() ([]*models.SystemConfig, error)
	GetByKey(key string) (*models.SystemConfig, error)
	SaveConfig(config *models.SystemConfig) error
}

type systemConfigService struct {
	repo       repository.SystemConfigRepository
	ldapConfig *config.LDAPConfig
}

func NewSystemConfigService(repo repository.SystemConfigRepository, ldapConfig *config.LDAPConfig) SystemConfigService {
	return &systemConfigService{
		repo:       repo,
		ldapConfig: ldapConfig,
	}
}

func (s *systemConfigService) GetLDAPConfig() (*models.LDAPConfig, error) {
	configs, err := s.repo.GetByPrefix("ldap_")
	if err != nil {
		log.Printf("[WARNING] Failed to get LDAP config from database: %v", err)
		// Return default config instead of error to allow system to continue
		return s.getDefaultLDAPConfig(), nil
	}

	if len(configs) == 0 {
		log.Printf("[WARNING] No LDAP config found in database, using defaults")
		return s.getDefaultLDAPConfig(), nil
	}

	ldapCfg := &models.LDAPConfig{}
	for _, cfg := range configs {
		switch cfg.ConfigKey {
		case "ldap_enabled":
			ldapCfg.Enabled = strings.ToLower(cfg.ConfigValue) == "true"
		case "ldap_host":
			ldapCfg.Host = cfg.ConfigValue
		case "ldap_port":
			fmt.Sscanf(cfg.ConfigValue, "%d", &ldapCfg.Port)
		case "ldap_use_ssl":
			ldapCfg.UseSSL = strings.ToLower(cfg.ConfigValue) == "true"
		case "ldap_insecure_skip_verify":
			ldapCfg.InsecureSkipVerify = strings.ToLower(cfg.ConfigValue) == "true"
		case "ldap_base_dn":
			ldapCfg.BaseDN = cfg.ConfigValue
		case "ldap_bind_dn":
			ldapCfg.BindDN = cfg.ConfigValue
		case "ldap_bind_password":
			if cfg.IsEncrypted && cfg.ConfigValue != "" {
				decrypted, err := utils.DecryptPassword(cfg.ConfigValue)
				if err != nil {
					log.Printf("[WARNING] Failed to decrypt LDAP bind password: %v", err)
					// Continue with original encrypted value to allow system to continue
					ldapCfg.BindPassword = cfg.ConfigValue
				} else {
					ldapCfg.BindPassword = decrypted
				}
			} else {
				ldapCfg.BindPassword = cfg.ConfigValue
			}
		case "ldap_user_search_filter":
			ldapCfg.UserSearchFilter = cfg.ConfigValue
		case "ldap_user_search_base_dn":
			ldapCfg.UserSearchBaseDN = cfg.ConfigValue
		case "ldap_username_attribute":
			ldapCfg.UsernameAttribute = cfg.ConfigValue
		case "ldap_email_attribute":
			ldapCfg.EmailAttribute = cfg.ConfigValue
		case "ldap_name_attribute":
			ldapCfg.NameAttribute = cfg.ConfigValue
		case "ldap_filter":
			ldapCfg.LDAPFilter = cfg.ConfigValue
		case "ldap_allow_username_or_email_login":
			ldapCfg.AllowUsernameOrEmailLogin = strings.ToLower(cfg.ConfigValue) == "true"
		case "ldap_auto_create_user":
			ldapCfg.AutoCreateUser = strings.ToLower(cfg.ConfigValue) == "true"
		case "ldap_group_base_dn":
			ldapCfg.GroupBaseDN = cfg.ConfigValue
		case "ldap_admin_group":
			ldapCfg.AdminGroup = cfg.ConfigValue
		case "ldap_admin_group_attribute":
			ldapCfg.AdminGroupAttribute = cfg.ConfigValue
		}
	}

	if ldapCfg.Port == 0 {
		ldapCfg.Port = 389
	}
	if ldapCfg.UsernameAttribute == "" {
		ldapCfg.UsernameAttribute = "uid"
	}
	if ldapCfg.EmailAttribute == "" {
		ldapCfg.EmailAttribute = "mail"
	}
	if ldapCfg.NameAttribute == "" {
		ldapCfg.NameAttribute = "cn"
	}
	if ldapCfg.UserSearchFilter == "" {
		ldapCfg.UserSearchFilter = "(uid=%{username})"
	}

	return ldapCfg, nil
}

func (s *systemConfigService) getDefaultLDAPConfig() *models.LDAPConfig {
	// Use config file LDAP settings as defaults
	return &models.LDAPConfig{
		Enabled:                   s.ldapConfig.Enabled,
		Host:                      s.ldapConfig.Host,
		Port:                      s.ldapConfig.Port,
		UseSSL:                    s.ldapConfig.UseSSL,
		InsecureSkipVerify:        s.ldapConfig.InsecureSkipVerify,
		BaseDN:                    s.ldapConfig.BaseDN,
		BindDN:                    s.ldapConfig.BindDN,
		BindPassword:              s.ldapConfig.BindPassword,
		UserSearchFilter:          s.ldapConfig.UserSearchFilter,
		UserSearchBaseDN:          s.ldapConfig.UserSearchBaseDN,
		UsernameAttribute:         s.ldapConfig.UsernameAttribute,
		EmailAttribute:            s.ldapConfig.EmailAttribute,
		NameAttribute:             s.ldapConfig.NameAttribute,
		LDAPFilter:                s.ldapConfig.LDAPFilter,
		AllowUsernameOrEmailLogin: s.ldapConfig.AllowUsernameOrEmailLogin,
		AutoCreateUser:            s.ldapConfig.AutoCreateUser,
		GroupBaseDN:               s.ldapConfig.GroupBaseDN,
		AdminGroup:                s.ldapConfig.AdminGroup,
	}
}

func (s *systemConfigService) SaveLDAPConfig(cfg *models.LDAPConfig) error {
	configs := map[string]struct {
		Value       string
		Description string
		Encrypted   bool
	}{
		"ldap_enabled":                       {Value: boolToString(cfg.Enabled), Description: "Enable LDAP authentication"},
		"ldap_host":                          {Value: cfg.Host, Description: "LDAP server host"},
		"ldap_port":                          {Value: fmt.Sprintf("%d", cfg.Port), Description: "LDAP server port"},
		"ldap_use_ssl":                       {Value: boolToString(cfg.UseSSL), Description: "Use SSL for LDAP connection"},
		"ldap_insecure_skip_verify":          {Value: boolToString(cfg.InsecureSkipVerify), Description: "Skip TLS certificate verification"},
		"ldap_base_dn":                       {Value: cfg.BaseDN, Description: "LDAP base DN"},
		"ldap_bind_dn":                       {Value: cfg.BindDN, Description: "LDAP bind DN for searching"},
		"ldap_bind_password":                 {Value: cfg.BindPassword, Description: "LDAP bind password (encrypted)", Encrypted: true},
		"ldap_user_search_filter":            {Value: cfg.UserSearchFilter, Description: "LDAP user search filter"},
		"ldap_user_search_base_dn":           {Value: cfg.UserSearchBaseDN, Description: "LDAP user search base DN"},
		"ldap_username_attribute":            {Value: cfg.UsernameAttribute, Description: "LDAP username attribute"},
		"ldap_email_attribute":               {Value: cfg.EmailAttribute, Description: "LDAP email attribute"},
		"ldap_name_attribute":                {Value: cfg.NameAttribute, Description: "LDAP name attribute"},
		"ldap_filter":                        {Value: cfg.LDAPFilter, Description: "Additional LDAP filter"},
		"ldap_allow_username_or_email_login": {Value: boolToString(cfg.AllowUsernameOrEmailLogin), Description: "Allow login with username or email"},
		"ldap_auto_create_user":              {Value: boolToString(cfg.AutoCreateUser), Description: "Auto create local user on LDAP login"},
		"ldap_group_base_dn":                 {Value: cfg.GroupBaseDN, Description: "LDAP group base DN"},
		"ldap_admin_group":                   {Value: cfg.AdminGroup, Description: "LDAP group for admin role"},
		"ldap_admin_group_attribute":         {Value: cfg.AdminGroupAttribute, Description: "LDAP admin group attribute name"},
	}

	for key, cfgData := range configs {
		value := cfgData.Value
		isEncrypted := cfgData.Encrypted
		if cfgData.Encrypted && value != "" {
			if utils.IsEncryptionEnabled() {
				encrypted, err := utils.EncryptPassword(value)
				if err != nil {
					return fmt.Errorf("failed to encrypt %s: %w", key, err)
				}
				value = encrypted
			} else {
				isEncrypted = false
			}
		}
		systemCfg := &models.SystemConfig{
			ConfigKey:   key,
			ConfigValue: value,
			Description: cfgData.Description,
			IsEncrypted: isEncrypted,
		}
		if err := s.repo.Save(systemCfg); err != nil {
			return fmt.Errorf("failed to save %s: %w", key, err)
		}
	}

	s.ldapConfig.Enabled = cfg.Enabled
	s.ldapConfig.Host = cfg.Host
	s.ldapConfig.Port = cfg.Port
	s.ldapConfig.UseSSL = cfg.UseSSL
	s.ldapConfig.InsecureSkipVerify = cfg.InsecureSkipVerify
	s.ldapConfig.BaseDN = cfg.BaseDN
	s.ldapConfig.BindDN = cfg.BindDN
	s.ldapConfig.BindPassword = cfg.BindPassword
	s.ldapConfig.UserSearchFilter = cfg.UserSearchFilter
	s.ldapConfig.UserSearchBaseDN = cfg.UserSearchBaseDN
	s.ldapConfig.UsernameAttribute = cfg.UsernameAttribute
	s.ldapConfig.EmailAttribute = cfg.EmailAttribute
	s.ldapConfig.NameAttribute = cfg.NameAttribute
	s.ldapConfig.LDAPFilter = cfg.LDAPFilter
	s.ldapConfig.AllowUsernameOrEmailLogin = cfg.AllowUsernameOrEmailLogin
	s.ldapConfig.AutoCreateUser = cfg.AutoCreateUser
	s.ldapConfig.GroupBaseDN = cfg.GroupBaseDN
	s.ldapConfig.AdminGroup = cfg.AdminGroup
	s.ldapConfig.AdminGroupAttribute = cfg.AdminGroupAttribute

	return nil
}

// TestLDAPConnection tests if the LDAP configuration is valid and can connect
func (s *systemConfigService) TestLDAPConnection(cfg *models.LDAPConfig) (bool, error) {
	testConfig := &config.LDAPConfig{
		Enabled:                   cfg.Enabled,
		Host:                      cfg.Host,
		Port:                      cfg.Port,
		UseSSL:                    cfg.UseSSL,
		InsecureSkipVerify:        cfg.InsecureSkipVerify,
		BaseDN:                    cfg.BaseDN,
		BindDN:                    cfg.BindDN,
		BindPassword:              cfg.BindPassword,
		UserSearchFilter:          cfg.UserSearchFilter,
		UserSearchBaseDN:          cfg.UserSearchBaseDN,
		UsernameAttribute:         cfg.UsernameAttribute,
		EmailAttribute:            cfg.EmailAttribute,
		NameAttribute:             cfg.NameAttribute,
		LDAPFilter:                cfg.LDAPFilter,
		AllowUsernameOrEmailLogin: cfg.AllowUsernameOrEmailLogin,
		AutoCreateUser:            cfg.AutoCreateUser,
		GroupBaseDN:               cfg.GroupBaseDN,
		AdminGroup:                cfg.AdminGroup,
		AdminGroupAttribute:       cfg.AdminGroupAttribute,
	}

	ldapService := NewLDAPService(testConfig)

	conn, err := ldapService.TestConnection()
	if err != nil {
		return false, err
	}
	defer conn.Close()

	if testConfig.BindDN != "" {
		err = conn.Bind(testConfig.BindDN, testConfig.BindPassword)
		if err != nil {
			return false, err
		}
	}

	return true, nil
}

func (s *systemConfigService) GetAllConfigs() ([]*models.SystemConfig, error) {
	return s.repo.GetAll()
}

func (s *systemConfigService) GetByKey(key string) (*models.SystemConfig, error) {
	return s.repo.GetByKey(key)
}

func (s *systemConfigService) SaveConfig(config *models.SystemConfig) error {
	return s.repo.Save(config)
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
