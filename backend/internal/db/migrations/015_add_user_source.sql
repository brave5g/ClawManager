-- Add source field to users table to distinguish local vs LDAP accounts
-- Created: 2026-05-10

ALTER TABLE users ADD COLUMN source VARCHAR(20) DEFAULT 'local' AFTER is_active;

UPDATE users SET source = 'local' WHERE source IS NULL OR source = '';

CREATE INDEX idx_users_source ON users(source);