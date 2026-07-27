package monitor

type ServiceStatus struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	Type       string `json:"type"`
	Status     string `json:"status"`
	StatusCode int    `json:"status_code,omitempty"`
	Latency    string `json:"latency"`
	Error      string `json:"error,omitempty"`
}
