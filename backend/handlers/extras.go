package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func (h *Handler) loadExtraServices() {
	data, err := os.ReadFile(h.dataPath)
	if err != nil {
		return
	}
	json.Unmarshal(data, &h.extraServices)
}

func (h *Handler) saveExtraServices() error {
	data, err := json.MarshalIndent(h.extraServices, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.dataPath, data, 0644)
}

func (h *Handler) extraServersPath() string {
	return filepath.Join(filepath.Dir(h.dataPath), "extra_servers.json")
}

func (h *Handler) loadExtraServers() {
	data, err := os.ReadFile(h.extraServersPath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &h.extraServers)
}

func (h *Handler) saveExtraServers() error {
	data, err := json.MarshalIndent(h.extraServers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.extraServersPath(), data, 0644)
}
