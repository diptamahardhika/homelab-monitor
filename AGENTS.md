# Agent Preferences

## Workflow
- After any code changes, always run the test suite on the test/dev system:
  `cd backend && go test ./...`
- After dev changes are tested and completed, also deploy and verify directly on prod (http://localhost:9876): rebuild the binary (`cd backend && go build -o /tmp/homelab-monitor-bin .`), restart the backend process with the same env (CONFIG_PATH, DATA_PATH, STATIC_DIR) as the running instance, and confirm the endpoints respond (e.g. `curl http://localhost:9876/api/health`, `/api/overview`).
- Never commit or push unless explicitly asked.
- "Commit to my repo" means: commit and open a PR only. Never merge or delete the branch unless explicitly asked.
