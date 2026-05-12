package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"

	"golang.org/x/crypto/bcrypt"
)

const DefaultPasswordLength = 16

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GenerateRandomPassword(length int) string {
	if length < 8 {
		length = DefaultPasswordLength
	}
	bytes := make([]byte, length)
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[],.?;:<>"
	for i := range bytes {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			bytes[i] = charset[0]
			continue
		}
		bytes[i] = charset[idx.Int64()]
	}
	return string(bytes)
}

func GenerateRandomPasswordBase64(length int) (string, error) {
	if length < 8 {
		length = DefaultPasswordLength
	}
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random password: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes)[:length], nil
}
