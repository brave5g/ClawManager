-- Add approval status field for LDAP auto-created users
-- Created: 2026-05-10
-- Status: pending (awaiting approval), approved (approved by admin), rejected (rejected by admin)

ALTER TABLE users ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved' AFTER source;

-- Set existing LDAP users to approved (they were created before this feature)
UPDATE users SET approval_status = 'approved' WHERE source = 'ldap' AND approval_status IS NULL;

-- Set existing local users to approved
UPDATE users SET approval_status = 'approved' WHERE source = 'local' AND approval_status IS NULL;

CREATE INDEX idx_users_approval_status ON users(approval_status);