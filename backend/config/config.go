package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Server struct {
	Name               string `yaml:"name"`
	Host               string `yaml:"host"`
	Port               int    `yaml:"port"`
	Type               string `yaml:"type"`
	Gateway            string `yaml:"gateway"`
	Timeout            string `yaml:"timeout"`
	ExpectedStatus     int    `yaml:"expected_status"`
	FollowRedirects    bool   `yaml:"follow_redirects"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
}

type Service struct {
	Name               string `yaml:"name"`
	URL                string `yaml:"url"`
	Type               string `yaml:"type"`
	Timeout            string `yaml:"timeout"`
	ExpectedStatus     int    `yaml:"expected_status"`
	FollowRedirects    bool   `yaml:"follow_redirects"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
}

type Config struct {
	Servers  []Server  `yaml:"servers"`
	Services []Service `yaml:"services"`
	Port     int       `yaml:"port"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	if cfg.Port == 0 {
		cfg.Port = 9876
	}

	return &cfg, nil
}

func (c *Config) Save(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
