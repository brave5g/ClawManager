package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID             int        `db:"id,primarykey,autoincrement" json:"id"`
	Username       string     `db:"username" json:"username"`
	Email          string     `db:"email" json:"email"`
	PasswordHash   string     `db:"password_hash" json:"-"`
	Role           string     `db:"role" json:"role"`
	IsActive       bool       `db:"is_active" json:"is_active"`
	Source         string     `db:"source" json:"source"`
	ApprovalStatus string     `db:"approval_status" json:"approval_status"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
	LastLogin      *time.Time `db:"last_login" json:"last_login,omitempty"`
	StatusText     string     `json:"status_text"`
}

// UserStatus constants
const (
	UserStatusPending  = "pending"  // 待审核
	UserStatusApproved = "approved" // 已审核
	UserStatusRejected = "rejected" // 已拒绝
)

// Status returns a human-readable status
func (u *User) Status() string {
	switch u.ApprovalStatus {
	case UserStatusPending:
		return "pending"
	case UserStatusApproved:
		if !u.IsActive {
			return "disabled"
		}
		return "approved"
	case UserStatusRejected:
		return "rejected"
	default:
		if !u.IsActive {
			return "disabled"
		}
		return "unknown"
	}
}

// TableName returns the table name for the User model
func (u User) TableName() string {
	return "users"
}
