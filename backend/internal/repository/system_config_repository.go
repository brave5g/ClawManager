package repository

import (
	"clawreef/internal/models"
	"time"

	"github.com/upper/db/v4"
)

type SystemConfigRepository interface {
	GetByKey(key string) (*models.SystemConfig, error)
	GetAll() ([]*models.SystemConfig, error)
	GetByPrefix(prefix string) ([]*models.SystemConfig, error)
	Save(config *models.SystemConfig) error
	Delete(key string) error
}

type systemConfigRepository struct {
	sess db.Session
}

func NewSystemConfigRepository(sess db.Session) SystemConfigRepository {
	return &systemConfigRepository{sess: sess}
}

func (r *systemConfigRepository) GetByKey(key string) (*models.SystemConfig, error) {
	var config models.SystemConfig
	err := r.sess.Collection("system_configs").Find(db.Cond{"config_key": key}).One(&config)
	if err != nil {
		if err == db.ErrNoMoreRows {
			return nil, nil
		}
		return nil, err
	}
	return &config, nil
}

func (r *systemConfigRepository) GetAll() ([]*models.SystemConfig, error) {
	var configs []*models.SystemConfig
	err := r.sess.Collection("system_configs").Find().OrderBy("config_key").All(&configs)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

func (r *systemConfigRepository) GetByPrefix(prefix string) ([]*models.SystemConfig, error) {
	var configs []*models.SystemConfig
	err := r.sess.Collection("system_configs").Find(db.Cond{"config_key LIKE": prefix + "%"}).OrderBy("config_key").All(&configs)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

func (r *systemConfigRepository) Save(config *models.SystemConfig) error {
	now := time.Now()
	existing, err := r.GetByKey(config.ConfigKey)
	if err != nil {
		return err
	}

	if existing != nil {
		existing.ConfigValue = config.ConfigValue
		existing.Description = config.Description
		existing.IsEncrypted = config.IsEncrypted
		existing.UpdatedAt = now
		return r.sess.Collection("system_configs").Find(db.Cond{"config_key": config.ConfigKey}).Update(existing)
	}

	config.CreatedAt = now
	config.UpdatedAt = now
	_, err = r.sess.Collection("system_configs").Insert(config)
	return err
}

func (r *systemConfigRepository) Delete(key string) error {
	return r.sess.Collection("system_configs").Find(db.Cond{"config_key": key}).Delete()
}
