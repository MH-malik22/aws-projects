# Build Roadmap

## Phase 0 — Foundations (Week 1)
- [x] Repo structure, docs, Docker Compose (Postgres + API + Web)
- [x] PostgreSQL schema (`backend/db/schema.sql`), Alembic baseline
- [x] CI skeleton: lint + test + build on every PR (`.github/workflows/ci.yml`)
- Exit: `docker compose up` boots the whole stack; CI green.

## Phase 1 — Auth + Content API (Weeks 2–3)
- Register / login / refresh / logout with rotation + revocation
- Content seeder: `content/modules/**` → DB (idempotent upserts keyed on slugs/external_ids)
- `GET /modules`, module detail, lesson bodies
- Exit: a new user can browse all 11 modules end-to-end via API.

## Phase 2 — Quiz Engine (Weeks 4–5)
- Attempt lifecycle: start → submit → graded review; version snapshots
- All four question types graded server-side; explanations returned post-submit
- Best-score cache, pass thresholds, XP awards
- Exit: 90%+ test coverage on grading logic; sample quiz passes e2e test.

## Phase 3 — Frontend Core (Weeks 6–8)
- Auth pages, sidebar layout, dashboard, module grid + detail, lesson reader
- Quiz runner UI + results/review, dark/light mode
- Exit: full learner journey clickable in staging.

## Phase 4 — Progress + Gamification (Week 9)
- Progress endpoints + dashboard rings, activity feed
- Badge rules engine + achievements page, XP/levels, streaks
- Exit: badges awarded correctly in integration tests.

## Phase 5 — Lab Engine v1: Simulated (Weeks 10–11)
- xterm.js terminal pane, step verification API, hints, order enforcement
- Author all module labs in `content/` as step definitions
- Exit: every module has ≥1 completable simulated lab.

## Phase 6 — Lab Engine v2: Container Sandboxes (Weeks 12–14, opt-in)
- Executor service, sandbox hardening (no net, read-only, limits, TTL reaper)
- WebSocket PTY proxy, verify scripts, concurrency caps
- Exit: Docker + Linux labs run in real sandboxes under load test (50 concurrent).

## Phase 7 — Hardening + Launch (Weeks 15–16)
- Load/perf pass (k6), a11y audit, security review (rate limits, headers, dependency scan)
- K8s manifests + Helm chart, staging → prod promotion in CD
- Exit: production deploy, monitoring dashboards live (the app monitors itself with Prometheus/Grafana — dogfooding module 11).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Container labs are an attack surface | Ship v1 simulated-only; v2 behind feature flag, isolated executor, no Docker socket in API |
| Content authoring bottleneck | Content-as-code in `content/`; PR review flow; seeder validates JSON against schema |
| Quiz answer leakage | Response models exclude answers pre-submit; contract test asserts it |
| Scope creep | Each phase has a hard exit criterion; gamification stays rule-driven data |
