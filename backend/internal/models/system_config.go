package models

import (
	"time"
)

type SystemConfig struct {
	ID          int       `db:"id,primarykey,autoincrement" json:"id"`
	ConfigKey   string    `db:"config_key" json:"config_key"`
	ConfigValue string    `db:"config_value" json:"config_value"`
	Description string    `db:"description" json:"description"`
	IsEncrypted bool      `db:"is_encrypted" json:"-"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

func (s SystemConfig) TableName() string {
	return "system_configs"
}

type LDAPConfig struct {
	Enabled                  bool   `json:"enabled"`
	Host                     string `json:"host"`
	Port                     int    `json:"port"`
	UseSSL                   bool   `json:"use_ssl"`
	InsecureSkipVerify       bool   `json:"insecure_skip_verify"`
	BaseDN                   string `json:"base_dn"`
	BindDN                   string `json:"bind_dn"`
	BindPassword             string `json:"bind_password,omitempty"`
	UserSearchFilter         string `json:"user_search_filter"`
	UserSearchBaseDN         string `json:"user_search_base_dn"`
	UsernameAttribute        string `json:"username_attribute"`
	EmailAttribute           string `json:"email_attribute"`
	NameAttribute            string `json:"name_attribute"`
	LDAPFilter               string `json:"ldap_filter"`
	AllowUsernameOrEmailLogin bool   `json:"allow_username_or_email_login"`
	AutoCreateUser           bool   `json:"auto_create_user"`
	GroupBaseDN              string `json:"group_base_dn"`
	AdminGroup               string `json:"admin_group"`
	AdminGroupAttribute      string `json:"admin_group_attribute"`
}
