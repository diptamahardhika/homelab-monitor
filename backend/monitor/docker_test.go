package monitor

import "testing"

func TestAppendPortDedupes(t *testing.T) {
	ports := ""
	seen := make(map[string]struct{})
	appendPort(&ports, seen, "9000:9000/tcp")
	appendPort(&ports, seen, "9000:9000/tcp")
	appendPort(&ports, seen, "8080:80/tcp")
	if ports != "9000:9000/tcp, 8080:80/tcp" {
		t.Fatalf("unexpected ports string: %q", ports)
	}
}