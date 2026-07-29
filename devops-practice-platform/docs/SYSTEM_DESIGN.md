# DevOps Practice Platform — System Design

This document describes the architecture, data model, API contract, progress
logic, and UI of the platform in enough detail to extend or reimplement it.

---

## 1. Goals

Teach 17 DevOps tools through a repeatable module template — **Concept → Notes →
Quiz → Hands-on Labs** — with measurable, per-learner progress along a
beginner → advanced path.

Non-goals (v1): real authentication, multi-tenant orgs, spaced repetition.
These are called out as extension points.

---

## 2. High-level architecture

```
                 ┌─────────────────────────────┐
                 │        Browser (SPA)         │
                 │  React + Vite + React Router │
                 │  pages: Dashboard, Path,     │
                 │         Module (tabs)        │
                 └──────────────┬──────────────┘
                                │  fetch  (x-user-id header)
                                │  /api/*
                 ┌──────────────▼──────────────┐
                 │      Express REST API        │
                 │  routes: modules, progress   │
                 │  middleware: user, errors    │
                 │  services: progress (logic)  │
                 └──────────────┬──────────────┘
                                │  pg (SQL)
                 ┌──────────────▼──────────────┐
                 │         PostgreSQL           │
                 │  modules, quiz_questions,    │
                 │  tasks, users, progress      │
                 └─────────────────────────────┘

   content/*.json ──(npm run seed)──▶ modules / quiz_questions / tasks
```

**Data flow (example — taking a quiz):**
1. SPA `GET /api/modules/docker/quiz` → questions **without** answers.
2. Learner answers; SPA `POST /api/modules/docker/quiz/submit` with a map of
   `{questionId: answer}`.
3. API grades server-side (answers never leave the server), recomputes the
   module percent, upserts the `progress` row, and returns the score, per-question
   explanations, and updated progress.
4. SPA updates the progress bar in place.

**Why this shape:**
- Content is authored as plain JSON so non-engineers can edit it; the DB is a
  seeded read model, not the authoring surface.
- Quiz answers are graded server-side to keep them out of the client bundle.
- Progress logic is a single pure function, unit-testable and reused by every
  write path.

---

## 3. Database schema (PostgreSQL)

See `server/src/db/schema.sql` (idempotent DDL). Summary:

| Table            | Key columns                                                                 | Notes |
|------------------|------------------------------------------------------------------------------|-------|
| `modules`        | `id`, `slug` (unique), `title`, `order_index`, `level`, `concept` jsonb, `notes` jsonb | One row per tool |
| `quiz_questions` | `id` (text, e.g. `docker-q1`), `module_id` fk, `position`, `type`, `question`, `options` jsonb, `answer` jsonb, `explanation` | `type` ∈ mcq/truefalse/scenario |
| `tasks`          | `id`, `module_id` fk, `position`, `level`, `title`, `goal`, `steps` jsonb, `success_criteria` jsonb | 4 per module |
| `users`          | `id`, `external_id` (unique), `display_name`                                 | `external_id` = `x-user-id` header |
| `progress`       | `user_id` fk, `module_id` fk, `notes_read`, `quiz_best_score`, `quiz_total`, `quiz_passed`, `tasks_completed` jsonb, `percent`, `updated_at` | unique `(user_id, module_id)` |

`answer` is stored as JSONB so it can hold an integer index (mcq/scenario) or a
boolean (truefalse) uniformly.

---

## 4. Content model (source of truth)

Each `content/<slug>.json`:

```jsonc
{
  "slug": "docker",
  "title": "Docker",
  "order": 3,
  "level": "beginner",                       // beginner | intermediate | advanced
  "concept": {
    "overview": "…",
    "whyItMatters": "…",
    "useCases": ["…"],
    "architecture": "described diagram text"
  },
  "notes": {
    "definitions":   [{ "term": "…", "def": "…" }],
    "commands":      [{ "cmd": "…", "desc": "…" }],
    "bestPractices": ["…"],
    "pitfalls":      ["…"],
    "cheatSheet":    ["…"]
  },
  "quiz": [                                   // 10–15 questions
    {
      "id": "docker-q1",
      "type": "mcq",                          // mcq | truefalse | scenario
      "question": "…",
      "options": ["…", "…"],                  // omitted/[] for truefalse
      "answer": 1,                            // index (mcq/scenario) OR boolean (truefalse)
      "explanation": "…"
    }
  ],
  "tasks": [                                  // 4 labs
    {
      "level": "beginner",                    // beginner|intermediate|advanced|simulation
      "title": "…",
      "goal": "…",
      "steps": ["…"],
      "successCriteria": ["…"]
    }
  ]
}
```

---

## 5. Progress logic

Implemented in `server/src/services/progress.js` as a pure function
`computePercent(...)`, then persisted by `updateProgress(...)`.

```
percent =  (notesRead        ? 20                                   : 0)
        +  (quizPassed        ? round(40 * bestScore/quizTotal)      : 0)   // quizPassed ⇔ score/total ≥ 0.70
        +  round((40 / taskCount) * min(tasksCompleted, taskCount))
```

- **Weights:** notes 20, quiz 40, tasks 40 (`WEIGHTS` constant).
- **Quiz:** must reach the 70% pass threshold to earn any quiz credit; once
  passed, credit scales with the *best* score ever achieved.
- **Tasks:** each of the 4 labs is worth an equal share (10% each here).
- **Module complete** when `percent === 100`.
- **Overall path progress** = mean of all module percents.

**Worked example (Docker, 4 tasks, 13-question quiz):**
- Mark notes read → 20%
- Pass quiz 13/13 → +40% → 60%
- Complete all 4 labs → +40% → **100% (complete)**

Serialized progress structure returned by the API:

```json
{
  "moduleId": 3,
  "notesRead": true,
  "quiz": { "bestScore": 13, "total": 13, "passed": true },
  "tasksCompleted": [0, 1, 2, 3],
  "taskCount": 4,
  "percent": 100,
  "complete": true,
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

---

## 6. API contract

Base URL: `/api`. All non-health routes resolve a user from the `x-user-id`
header (default `demo-user`). Request/response bodies are JSON.

### `GET /api/health`
`200 → { "status": "ok", "db": "up" }`

### `GET /api/modules`
```json
{
  "overallPercent": 24,
  "count": 17,
  "modules": [
    { "id": 1, "slug": "git-github", "title": "Git & GitHub", "order": 1,
      "level": "beginner", "percent": 60, "complete": false,
      "notesRead": true, "taskCount": 4, "quizCount": 13 }
  ]
}
```

### `GET /api/modules/:slug`
Returns `{ id, slug, title, order, level, concept, notes, progress }`.

### `GET /api/modules/:slug/quiz`
Questions **without** answers:
```json
{ "slug": "docker", "total": 13,
  "questions": [ { "id": "docker-q1", "type": "mcq", "question": "…", "options": ["…"] } ] }
```

### `POST /api/modules/:slug/quiz/submit`
Request: `{ "answers": { "docker-q1": 1, "docker-q2": true } }`
Response:
```json
{
  "slug": "docker", "score": 11, "total": 13, "percentage": 85, "passed": true,
  "results": [
    { "id": "docker-q1", "correct": true, "correctAnswer": 1, "given": 1, "explanation": "…" }
  ],
  "progress": { "...serialized progress..." }
}
```

### `GET /api/modules/:slug/tasks`
```json
{ "slug": "docker",
  "tasks": [ { "position": 0, "level": "beginner", "title": "…", "goal": "…",
               "steps": ["…"], "successCriteria": ["…"], "completed": false } ] }
```

### `GET /api/progress`
All module progress for the current user, plus `overallPercent`.

### `POST /api/progress/:slug`
Request (any one): `{ "notesRead": true }` | `{ "completeTask": 0 }` |
`{ "uncompleteTask": 0 }`. Returns the updated serialized progress.

Errors use `{ "error": "message" }` with appropriate status codes (400/404/500).

---

## 7. UI screens

Visual identity: **"control plane, after dark."** The learner's path is
rendered as a live CI/CD pipeline run — stages move `queued (○) → running (◍) →
passed (●)`, and a completed module is an `exit 0`. Type is IBM Plex Mono
(labels/terminal voice) + IBM Plex Sans (body); the field is warm blue-graphite
with an amber "running" accent, and green/red are reserved for pass/fail only.
Light and dark themes are supported via `prefers-color-scheme` and a toggle.

**Dashboard (`/`)** — a shell-prompt top bar (`devops@practice:~$ learn`), then
the signature **pipeline hero**: a horizontal track of the seventeen stages by status,
a "now running / next up" panel that deep-links you back into your current
stage, and a status/percent readout. Below is a responsive grid of **stage
cards**, each showing the stage number, a status chip (`exit 0` / `running` /
`queued`), title, a 1–3 signal-bar difficulty meter, quiz/lab counts, and a
progress bar. The next stage to tackle is badged `next`.

**Learning Path (`/path`)** — the same pipeline as a vertical roadmap: numbered
nodes that turn green when a stage passes, each row clickable with its progress
bar. A different read of the beginner → advanced sequence.

**Module (`/modules/:slug`)** — a job-detail header (`run / <slug>` breadcrumb,
stage number, difficulty, live progress bar), then four tabs that show a green
tick when complete, plus a contextual next-step prompt:
- **Concept** — overview, why it matters, real-world use cases, and an
  architecture description in a highlighted callout.
- **Notes** — definitions table, a horizontally-scrolling commands table,
  best-practices and pitfalls columns, and a cheat sheet; a "mark notes as read
  · +20%" button.
- **Quiz** — an answered-progress bar, one card per question with radio options,
  and a sticky submit. On submit a `PASS/FAIL · exit 0/1` banner (announced via
  `role="status"`) appears and each option is marked with an **icon and text
  label** ("✓ correct" / "✗ your answer" / "correct answer") — never colour
  alone — with explanations; a "retake" action resets it.
- **Labs** — a card per hands-on task (beginner → simulation) with goal, steps,
  success criteria, and a "mark done" toggle (44px target) that updates progress.

**Progress bar component** — an animated fill with a monospace label that reads
the percent, switching to `exit 0` (green) at 100%. The label always carries the
value, so meaning never depends on colour. Reused on stage cards, path, module
header, and the resume panel.

Screenshots of the current design live in [`img/`](img/).

---

## 8. Deployment

- **Local dev:** Vite dev server proxies `/api` to the Express server; Postgres
  runs locally.
- **Docker Compose:** three services — `db` (postgres:16), `api` (builds from
  `server/`, runs `migrate` + `seed` on boot), and `web` (multi-stage build,
  served by nginx with SPA fallback). See `docker-compose.yml`.

---

## 9. Extension points

- **Auth:** replace `server/src/middleware/user.js` (currently header-based) with
  real sessions/JWT; the rest of the code already keys on `req.user.id`.
- **New modules:** drop a `content/<slug>.json` and re-seed — no code changes.
- **Richer grading:** partial credit, timed quizzes, or spaced repetition can
  extend `progress.js` and the `progress` table.
- **Analytics:** the per-user `progress` rows and `updated_at` support cohort and
  completion reporting.
```
