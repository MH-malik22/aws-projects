# Application Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Browser                                │
│   Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS    │
│   xterm.js (lab terminal) · SWR (data fetching) · next-themes       │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTPS / JSON  (JWT Bearer)
┌───────────────▼─────────────────────────────────────────────────────┐
│                        FastAPI Backend (ASGI)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Auth    │ │ Modules  │ │  Quiz    │ │   Lab    │ │ Progress/ │  │
│  │  Router  │ │  Router  │ │  Engine  │ │  Engine  │ │  Badges   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│        SQLAlchemy 2.0 async ORM · Pydantic v2 · Alembic             │
└───────┬──────────────────────────────┬──────────────────────────────┘
        │                              │ (lab engine v2, opt-in)
┌───────▼────────┐            ┌────────▼─────────────────────────┐
│ PostgreSQL 16  │            │  Docker Executor Service         │
│ users, modules │            │  ephemeral sandbox containers    │
│ quizzes, labs, │            │  (cpu/mem/pids limits, no net,   │
│ progress, xp   │            │   read-only rootfs, 15min TTL)   │
└────────────────┘            └──────────────────────────────────┘
```

## 2. Technology Choices — Rationale

| Layer | Choice | Why (vs alternatives) |
|---|---|---|
| Frontend | Next.js 14 | File-based routing, RSC for content-heavy pages, SSG for module docs, best React ecosystem. Vue viable but smaller hiring pool; plain React (Vite) loses SSR/SEO for public module pages. |
| Backend | FastAPI | Async I/O fits quiz/lab bursts, Pydantic gives request validation for free, auto OpenAPI powers the frontend client. Node/Express weaker typing story; Go faster but slower iteration for CRUD-heavy app. |
| DB | PostgreSQL | JSONB for quiz options/answers, transactional grading, mature migrations. |
| Auth | JWT access (15 min) + refresh (7 d) rotation | Stateless API scaling; refresh tokens stored hashed in DB → revocable. |
| Content | Git-versioned markdown/JSON seeded into DB | Reviewable via PRs, diffable, no CMS to run. |

## 3. Backend Architecture

```
backend/app/
├── main.py            # FastAPI app factory, CORS, router mounting, /healthz
├── config.py          # Pydantic Settings (env-driven: DATABASE_URL, JWT_SECRET…)
├── database.py        # async engine + session dependency
├── models.py          # SQLAlchemy ORM models (mirrors db/schema.sql)
├── schemas.py         # Pydantic request/response models
├── auth.py            # password hashing, JWT create/verify, current-user deps
├── seed.py            # idempotent content loader: content/ → DB
└── routers/
    ├── auth.py        # /api/v1/auth/*
    ├── modules.py     # /api/v1/modules/*  (lessons nested)
    ├── quizzes.py     # /api/v1/quizzes/*  (quiz engine)
    ├── labs.py        # /api/v1/labs/*     (lab engine)
    └── progress.py    # /api/v1/progress/* + /api/v1/badges
```

### Request lifecycle
1. `Authorization: Bearer <access-token>` → `get_current_user` dependency decodes JWT, loads user.
2. Router handler validates body via Pydantic schema.
3. Async SQLAlchemy session (per-request) executes; commits on success.
4. Response serialized by Pydantic response model — internal fields (correct answers before submission!) never leak.

## 4. Quiz Engine Design

**Principles:** server-side grading only; the client never receives correct answers or
explanations until an attempt is submitted.

- Quiz banks live in `content/modules/*/quiz.json`, seeded into `questions` with JSONB `options`.
- `POST /quizzes/{id}/attempts` creates an attempt snapshotting the question set (quiz versioning: editing content later doesn't corrupt past attempts).
- `POST /attempts/{id}/submit` grades atomically:
  - `mcq` / `scenario`: selected index == `correct_index`
  - `true_false`: boolean match
  - `command`: normalized string match against `accepted_answers[]` (whitespace collapsed, case-sensitive by default per question flag)
- Response returns per-question verdict + explanation + score; best score persisted to `user_quiz_scores`.
- Pass threshold per quiz (default 70) → unlocks module-mastery badge checks.

## 5. Lab Engine Design

### v1 — Simulated terminal (default, zero infra risk)
- Frontend renders xterm.js; lab steps come from `lab_steps` rows.
- Each step defines `expected_commands[]` (regex or literal) and `mock_output`.
- User types a command → matched client-side for instant feedback, and `POST /labs/{id}/steps/{n}/verify` records server-side completion (progress can't be forged by skipping steps: server enforces step order).

### v2 — Container-backed real labs (opt-in deployment)
- Executor service (separate container with Docker socket **not** shared to API) receives
  `{lab_id, user_id}` over an internal queue, launches a sandbox:
  `--memory 256m --cpus 0.5 --pids-limit 128 --network none --read-only --rm`, TTL 15 min.
- WebSocket proxy: browser ⇄ API ⇄ executor ⇄ container PTY.
- Verification scripts (`labs.verify_script`) run inside the sandbox and report step completion.
- Hard cap per user: 1 concurrent sandbox; reaper kills expired containers.

## 6. Authentication & Progress Tracking

- Register → email + password (bcrypt, cost 12). Login → access JWT (15 min, HS256) + refresh token (random 256-bit, stored as SHA-256 hash, 7-day expiry, rotated on use).
- Roles: `learner` (default), `admin` (content endpoints, user management).
- Progress model: every completable thing is a row —
  `lesson_progress`, `lab_progress` (per step), `quiz_attempts` → aggregated into
  `module_progress` view (% complete) consumed by the dashboard.
- XP: lesson complete +10, lab step +5, quiz pass +50 (+bonus for ≥90%). Level = floor(sqrt(xp/100)).
- Badges evaluated by rules engine after each progress write (see `docs/02-database-schema.md`).

## 7. Non-Functional

| Concern | Approach |
|---|---|
| Security | bcrypt, JWT rotation, rate-limit auth endpoints (SlowAPI 10/min), CORS allowlist, no correct answers in pre-submit payloads, sandboxed labs |
| Observability | structured JSON logs, `/healthz` + `/readyz`, Prometheus `/metrics` (instrumentator) — the app dogfoods its own monitoring module |
| Scaling | stateless API → horizontal replicas; Postgres connection pool; lab executor scales independently |
| Testing | pytest + httpx (API), vitest + React Testing Library (UI), Playwright (e2e) |
