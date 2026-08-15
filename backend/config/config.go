package config

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Server struct {
	Name             string        `yaml:"name"`
	Host             string        `yaml:"host"`
	Port             int           `yaml:"port"`
	Type             string        `yaml:"type"`
	Gateway          string        `yaml:"gateway"`
	Timeout          time.Duration `yaml:"timeout"`
	ExpectedStatus   int           `yaml:"expected_status"`
	FollowRedirects  bool          `yaml:"follow_redirects"`
	InsecureSkipVerify bool        `yaml:"insecure_skip_verify"`
}

type Service struct {
	Name               string        `yaml:"name"`
	URL                string        `yaml:"url"`
	Type               string        `yaml:"type"`
	Timeout            time.Duration `yaml:"timeout"`
	ExpectedStatus     int           `yaml:"expected_status"`
	FollowRedirects    bool          `yaml:"follow_redirects"`
	InsecureSkipVerify bool          `yaml:"insecure_skip_verify"`
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

	// Set defaults for server checks
	for i := range cfg.Servers {
		if cfg.Servers[i].Timeout == 0 {
			cfg.Servers[i].Timeout = 5 * time.Second
		}
	}

	// Set defaults for service checks
	for i := range cfg.Services {
		if cfg.Services[i].Timeout == 0 {
			cfg.Services[i].Timeout = 10 * time.Second
		}
	}

	return &cfg, nil
}
