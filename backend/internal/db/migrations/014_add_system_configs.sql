CREATE TABLE IF NOT EXISTS system_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description VARCHAR(500),
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_configs (config_key, config_value, description, is_encrypted) VALUES
('ldap_enabled', 'false', 'Enable LDAP authentication', FALSE),
('ldap_host', '', 'LDAP server host', FALSE),
('ldap_port', '389', 'LDAP server port', FALSE),
('ldap_use_ssl', 'false', 'Use SSL for LDAP connection', FALSE),
('ldap_base_dn', '', 'LDAP base DN', FALSE),
('ldap_bind_dn', '', 'LDAP bind DN for searching', FALSE),
('ldap_bind_password', '', 'LDAP bind password (encrypted)', TRUE),
('ldap_user_search_filter', '(uid=%{username})', 'LDAP user search filter', FALSE),
('ldap_user_search_base_dn', '', 'LDAP user search base DN', FALSE),
('ldap_username_attribute', 'uid', 'LDAP username attribute', FALSE),
('ldap_email_attribute', 'mail', 'LDAP email attribute', FALSE),
('ldap_name_attribute', 'cn', 'LDAP name attribute', FALSE),
('ldap_filter', '', 'Additional LDAP filter', FALSE),
('ldap_allow_username_or_email_login', 'true', 'Allow login with username or email', FALSE),
('ldap_auto_create_user', 'true', 'Auto create local user on LDAP login', FALSE),
('ldap_group_base_dn', '', 'LDAP group base DN', FALSE),
('ldap_admin_group', '', 'LDAP group for admin role', FALSE)
ON DUPLICATE KEY UPDATE config_key = config_key;
