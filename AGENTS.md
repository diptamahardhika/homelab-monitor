# Agent Preferences

## Workflow
- After any code changes, always run the test suite on the test/dev system:
  `cd backend && go test ./...`
- After dev changes are tested and completed, also deploy and verify directly on prod (http://localhost:9876): rebuild the binary with commit info injected (`cd backend && go build -ldflags "-X github.com/pradiptamahardika/homelab-monitor/handlers.Commit=$(git rev-parse --short=8 HEAD)$(git diff --quiet || echo -dirty) -X github.com/pradiptamahardika/homelab-monitor/handlers.CommitTime=$(git log -1 --format=%cI)" -o /tmp/homelab-monitor-bin .`), restart the backend process with the same env (CONFIG_PATH, DATA_PATH, STATIC_DIR) as the running instance, and confirm the endpoints respond (e.g. `curl http://localhost:9876/api/health`, `/api/version`, `/api/overview`).
- Never commit or push unless explicitly asked.
- Every change must also work in the CI + Docker build path, not just the local native build: if a change touches build-time behavior (e.g. ldflags, build args, static assets), verify the `.github/workflows/docker.yml`, `Dockerfile`, and `restart.sh` are updated consistently too (docker.yml pushes the ghcr.io `latest` image that remote prod deployments pull).
- Branch selection: a `feat:` change goes on a feature branch (create one if none exists); a `ui/ux:` change goes on the `ui/ux-improvement` branch. Other changes stay on the current branch unless the user says otherwise.
- "Commit to my repo" means: commit and open a PR only. Never merge or delete the branch unless explicitly asked.
