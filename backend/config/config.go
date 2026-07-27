package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Server struct {
	Name    string `yaml:"name"`
	Host    string `yaml:"host"`
	Port    int    `yaml:"port"`
	Type    string `yaml:"type"`
}

type Service struct {
	Name string `yaml:"name"`
	URL  string `yaml:"url"`
	Type string `yaml:"type"`
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
