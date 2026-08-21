# Maintainability Refactor Plan (Dashboard / handlers.go / graph layout)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce complexity debt in the three worst offenders without changing any runtime behavior.

**Architecture:** Pure code-motion refactor. Frontend: extract hooks + pure modules from god-components. Backend: split one 915-line handler file into domain files within the same package (zero signature changes).

**Tech Stack:** React 18 + Vite (frontend), Go + chi (backend).

**Spec:** Session decision 2026-08-21 — items 1-3 of maintainability list. Behavior-preserving; no API, UI, or persistence changes.

## Global Constraints

- No behavior changes: identical HTTP responses, DOM output, localStorage keys, timing.
- Branch: current branch (`master`) per AGENTS.md (not feat:/ui/ux:).
- No commits unless user asks.
- Verify with `cd backend && go test ./...` and `cd frontend && npm run build` after each task.
- New frontend test runner allowed only for Task 3 (vitest, devDependency).

---

### Task 1: Split `handlers.go` by domain

**Files:**
- Modify: `backend/handlers/handlers.go` (shrinks to core wiring)
- Create: `backend/handlers/extras.go`, `servers.go`, `services.go`, `docker.go`, `system.go`, `config_handlers.go`, `export_import.go`, `dependencies.go`

**Interfaces:** Same package `handlers`; no exported symbol moves across packages. Distribution:
- `handlers.go` keeps: consts (`defaultRefreshInterval`, `defaultCheckConcurrency`), build vars, `Overview`, `Handler`, `New`, `Start`, `collectOverview`, `currentOverview`, `overviewNow`, `Health`, `Version`, `Overview`, `jsonError`.
- `extras.go`: `loadExtraServices`, `saveExtraServices`, `extraServersPath`, `loadExtraServers`, `saveExtraServers`.
- `servers.go`: `Servers`, `AddServer`, `UpdateServer`, `DeleteServer`.
- `services.go`: `Services`, `AddService`, `UpdateService`, `DeleteService`.
- `docker.go`: `DockerContainers`, `DockerContainerDetail`.
- `system.go`: `System`, `History`, `SystemHistory`.
- `config_handlers.go`: `GetConfig`, `ConfigUpdateRequest`, `UpdateConfig`.
- `export_import.go`: `ExportConfig` (type + handler), `exportConfigVersion`, `ImportConfig`.
- `dependencies.go`: `GetDependencies`, `DependencyRequest`, `AddDependency`, `UpdateDependency`, `DeleteDependency`, `ReorderDependencies`.
- Imports per file: only what that file uses (goimports rule).

- [ ] Step 1: Move code verbatim into new files; trim imports per file.
- [ ] Step 2: `go build ./... && go vet ./...`
- [ ] Step 3: `go test ./...` — expect PASS (existing suites cover these paths).

### Task 2: Extract pure graph-layout module + tests

**Files:**
- Create: `frontend/src/lib/graphLayout.js` — exports `NODE_W, NODE_H, GAP_X, GAP_Y, PAD, layoutGraph(deps), nodeMeta(name, servers, services, containers)`
- Modify: `frontend/src/components/DependencyGraph.jsx` — import from lib, drop local defs + re-export line
- Create: `frontend/src/lib/graphLayout.test.js`
- Modify: `frontend/package.json` — add vitest devDep + `"test": "vitest run"`

**Tests (graphLayout.test.js):** empty input → `{edges:[],nodes:[],W,H>0}`; linear chain A→B→C layers 0/1/2; diamond A→B,A→C,B→D,C→D gives D layer 2 (longest path); cycle A→B→A places both layer 0 without hang; self-loop skipped; duplicate edges counted once in nodes; nodeMeta precedence service > server > container > unknown with correct colors.

- [ ] Step 1: Move `layoutGraph`, `nodeMeta`, size consts verbatim to lib.
- [ ] Step 2: Update component imports; delete local defs.
- [ ] Step 3: Write failing tests, `npx vitest run` → PASS.
- [ ] Step 4: `npm run build` — PASS.

### Task 3: Decompose `Dashboard.jsx` into hooks

**Files:**
- Create: `frontend/src/hooks/useToast.js` — `{toast, showToast}` (3.5s auto-dismiss, timer ref)
- Create: `frontend/src/hooks/useTheme.js` — `[dark, toggleTheme]` + init effect (localStorage `theme`, prefers-color-scheme)
- Create: `frontend/src/hooks/useVersion.js` — `{version, commit, commitTime}` from `/api/version`
- Create: `frontend/src/hooks/useClock.js` — `now` ticking every 1000ms
- Create: `frontend/src/hooks/useOverview.js` — servers/services/containers/systemStats/loading/error/liveStatus/lastUpdated/refreshing + latencyHistoryRef/historyStatsRef + `fetchAll`/`manualRefresh`; contains applyData, SSE connect + polling fallback + visibilitychange + stale detection (>15s)
- Modify: `frontend/src/api.js` — add `errorMessage(res, fallback)` helper (parse `{error}` body)
- Modify: `frontend/src/components/Dashboard.jsx` — compose hooks; keep StatusBanner, modals wiring, panel state, delete/export/import handlers (using `errorMessage`); title/favicon effect stays here (depends on servers/services)

**Interfaces:** Hook signatures above are exact; Dashboard renders identical JSX tree.

- [ ] Step 1: Create hooks, move code verbatim.
- [ ] Step 2: Rewrite Dashboard as composition (~250 lines target).
- [ ] Step 3: `npm run build` PASS; manual smoke via prod restart (AGENTS.md deploy step).

## Self-Review

- Spec coverage: items 1-3 all mapped to tasks. ✔
- Placeholders: none — all moves are verbatim code motion. ✔
- Type consistency: hook return shapes match Dashboard usage listed. ✔
