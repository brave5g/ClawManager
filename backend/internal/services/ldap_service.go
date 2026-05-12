package services

import (
	"crypto/tls"
	"fmt"
	"log"
	"strings"

	"clawreef/internal/config"
	"clawreef/internal/models"

	"github.com/go-ldap/ldap/v3"
)

const ProviderNameLDAP = "ldap"

type ldapProviderConfig struct {
	cfg *config.LDAPConfig
}

func (c *ldapProviderConfig) IsEnabled() bool {
	return c.cfg.Enabled
}

func (c *ldapProviderConfig) GetProviderName() string {
	return ProviderNameLDAP
}

type ldapService struct {
	config *config.LDAPConfig
}

func NewLDAPService(cfg *config.LDAPConfig) *ldapService {
	return &ldapService{
		config: cfg,
	}
}

func (s *ldapService) ProviderName() string {
	return ProviderNameLDAP
}

func (s *ldapService) IsEnabled() bool {
	return s.config.Enabled
}

func (s *ldapService) GetProviderConfig() ProviderConfig {
	return &ldapProviderConfig{cfg: s.config}
}

func (s *ldapService) Authenticate(credentials map[string]string) (*models.ExternalUser, error) {
	username := credentials["username"]
	password := credentials["password"]

	if !s.config.Enabled {
		return nil, fmt.Errorf("LDAP authentication is not enabled")
	}

	if username == "" || password == "" {
		return nil, fmt.Errorf("username and password are required")
	}

	l, err := s.connect()
	if err != nil {
		log.Printf("LDAP connection error: %v", err)
		return nil, fmt.Errorf("LDAP connection failed: unable to reach LDAP server")
	}
	defer l.Close()

	if s.config.BindDN != "" {
		if err := l.Bind(s.config.BindDN, s.config.BindPassword); err != nil {
			log.Printf("LDAP service bind error for DN %s: %v", maskDN(s.config.BindDN), err)
			return nil, fmt.Errorf("LDAP service bind failed: %v", err)
		}
	}

	userInfo, err := s.searchUser(l, username)
	if err != nil {
		log.Printf("LDAP search error for user %s: %v", username, err)
		return nil, fmt.Errorf("LDAP search failed: user not found in directory")
	}

	if err := l.Bind(userInfo.DN, password); err != nil {
		log.Printf("LDAP authentication failed for user %s: %v", username, err)
		return nil, fmt.Errorf("authentication failed")
	}

	groups := []string{}
	isAdmin, err := s.checkAdminGroup(l, userInfo.DN)
	if err != nil {
		log.Printf("LDAP admin group check error: %v", err)
	} else if isAdmin {
		groups = append(groups, "admin")
	}

	return &models.ExternalUser{
		Provider:       ProviderNameLDAP,
		ProviderUserID: userInfo.DN,
		Username:       userInfo.Username,
		Email:          userInfo.Email,
		Name:           userInfo.Name,
		Groups:         groups,
	}, nil
}

func (s *ldapService) TestConnection() (*ldap.Conn, error) {
	return s.connect()
}

func (s *ldapService) connect() (*ldap.Conn, error) {
	address := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	if s.config.UseSSL {
		return ldap.DialTLS("tcp", address, &tls.Config{
			InsecureSkipVerify: s.config.InsecureSkipVerify,
			ServerName:         s.config.Host,
		})
	}

	return ldap.Dial("tcp", address)
}

func (s *ldapService) searchUser(l *ldap.Conn, username string) (*LDAPUserInfo, error) {
	searchBaseDN := s.config.UserSearchBaseDN
	if searchBaseDN == "" {
		searchBaseDN = s.config.BaseDN
	}

	filter := strings.ReplaceAll(s.config.UserSearchFilter, "%{username}", ldap.EscapeFilter(username))

	if s.config.LDAPFilter != "" {
		filter = fmt.Sprintf("(&%s%s)", filter, s.config.LDAPFilter)
	}

	attributes := []string{
		s.config.UsernameAttribute,
		s.config.EmailAttribute,
		s.config.NameAttribute,
	}

	searchRequest := ldap.NewSearchRequest(
		searchBaseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0,
		0,
		false,
		filter,
		attributes,
		nil,
	)

	sr, err := l.Search(searchRequest)
	if err != nil {
		return nil, err
	}

	if len(sr.Entries) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	if len(sr.Entries) > 1 {
		return nil, fmt.Errorf("multiple users found")
	}

	entry := sr.Entries[0]

	userInfo := &LDAPUserInfo{
		DN: entry.DN,
	}

	if attr := entry.GetAttributeValue(s.config.UsernameAttribute); attr != "" {
		userInfo.Username = attr
	} else {
		userInfo.Username = username
	}

	if attr := entry.GetAttributeValue(s.config.EmailAttribute); attr != "" {
		userInfo.Email = attr
	}

	if attr := entry.GetAttributeValue(s.config.NameAttribute); attr != "" {
		userInfo.Name = attr
	}

	return userInfo, nil
}

func (s *ldapService) checkAdminGroup(l *ldap.Conn, userDN string) (bool, error) {
	if s.config.AdminGroup == "" || s.config.GroupBaseDN == "" {
		return false, nil
	}

	groupAttribute := s.config.AdminGroupAttribute
	if groupAttribute == "" {
		groupAttribute = "cn"
	}

	filter := fmt.Sprintf("(&(objectClass=groupOfNames)(%s=%s)(member=%s))",
		ldap.EscapeFilter(groupAttribute),
		ldap.EscapeFilter(s.config.AdminGroup),
		ldap.EscapeFilter(userDN),
	)

	searchRequest := ldap.NewSearchRequest(
		s.config.GroupBaseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0,
		0,
		false,
		filter,
		[]string{"cn"},
		nil,
	)

	sr, err := l.Search(searchRequest)
	if err != nil {
		log.Printf("Warning: Failed to check admin group: %v", err)
		return false, nil
	}

	return len(sr.Entries) > 0, nil
}

type LDAPUserInfo struct {
	Username string
	Email    string
	Name     string
	DN       string
}

func maskDN(dn string) string {
	if dn == "" {
		return "empty"
	}
	parts := strings.SplitN(dn, "=", 2)
	if len(parts) == 2 {
		return parts[0] + "=***"
	}
	return "***"
}
