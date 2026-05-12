package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"hash"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/hkdf"
)

var encryptionKey []byte
var encryptionSalt []byte
var encryptionEnabled bool

func InitEncryption() error {
	key := os.Getenv("LDAP_PASSWORD_KEY")
	if key == "" {
		log.Printf("Warning: LDAP_PASSWORD_KEY not set, encryption disabled for LDAP passwords")
		encryptionEnabled = false
		return nil
	}

	salt := os.Getenv("LDAP_PASSWORD_SALT")
	if salt == "" {
		salt = "clawreef-ldap-salt-v1"
	}
	encryptionSalt = []byte(salt)

	hash := func() hash.Hash { return sha256.New() }

	kdf := hkdf.New(hash, []byte(key), encryptionSalt, []byte("clawreef-ldap-encryption"))
	encryptionKey = make([]byte, 32)
	if _, err := kdf.Read(encryptionKey); err != nil {
		return fmt.Errorf("failed to derive encryption key: %v", err)
	}

	encryptionEnabled = true
	return nil
}

func IsEncryptionEnabled() bool {
	return encryptionEnabled
}

func EncryptPassword(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	if !encryptionEnabled {
		return plaintext, nil
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// 包含密钥版本信息，支持密钥轮换
	keyVersion := getKeyVersion()
	result := fmt.Sprintf("v%d:%s", keyVersion, base64.StdEncoding.EncodeToString(ciphertext))
	return result, nil
}

func getKeyVersion() int {
	return 1
}

func DecryptPassword(encryptedText string) (string, error) {
	if encryptedText == "" {
		return "", nil
	}

	// 移除可能的 enc: 前缀
	if strings.HasPrefix(encryptedText, "enc:") {
		encryptedText = strings.TrimPrefix(encryptedText, "enc:")
	}

	// 如果数据看起来是加密的（有版本前缀）
	// 尝试解密
	if strings.HasPrefix(encryptedText, "v") {
		if !encryptionEnabled {
			log.Printf("[WARNING] Encryption is not enabled, returning original encrypted value")
			return encryptedText, nil
		}

		parts := strings.SplitN(encryptedText, ":", 2)
		if len(parts) != 2 {
			return "", errors.New("invalid encrypted format: missing version separator")
		}

		keyVersion := parts[0][1:] // 移除 'v' 前缀
		if keyVersion != "1" {
			return "", fmt.Errorf("unsupported key version: %s", keyVersion)
		}
		encodedCiphertext := parts[1]

		ciphertext, err := base64.StdEncoding.DecodeString(encodedCiphertext)
		if err != nil {
			return "", fmt.Errorf("failed to decode ciphertext: %w", err)
		}

		block, err := aes.NewCipher(encryptionKey)
		if err != nil {
			return "", fmt.Errorf("failed to create cipher: %w", err)
		}

		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return "", fmt.Errorf("failed to create GCM: %w", err)
		}

		nonceSize := gcm.NonceSize()
		if len(ciphertext) < nonceSize {
			return "", errors.New("ciphertext too short")
		}

		nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
		plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
		if err != nil {
			return "", fmt.Errorf("failed to decrypt: %w", err)
		}

		return string(plaintext), nil
	}

	// 不是加密格式，直接返回原始文本
	return encryptedText, nil
}
