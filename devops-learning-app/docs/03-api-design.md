# API Design (REST, `/api/v1`)

FastAPI serves OpenAPI docs at `/docs`. All endpoints return JSON. Authenticated routes
require `Authorization: Bearer <access_token>`. Errors follow one shape:

```json
{ "detail": "Quiz attempt already submitted", "code": "attempt_closed" }
```

## 1. Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Issue access + refresh tokens |
| POST | `/auth/refresh` | — | Rotate refresh token, new access token |
| POST | `/auth/logout` | ✅ | Revoke refresh token |
| GET | `/auth/me` | ✅ | Current user profile (xp, level, role, theme) |
| PATCH | `/auth/me` | ✅ | Update display name / theme preference |

```jsonc
// POST /auth/register
{ "email": "dev@example.com", "password": "S3cure!pass", "display_name": "Dev" }
// 201 → { "id": "…", "email": "…", "display_name": "Dev", "role": "learner" }

// POST /auth/login → 200
{ "access_token": "eyJ…", "refresh_token": "b64…", "token_type": "bearer", "expires_in": 900 }
```

## 2. Modules & Lessons

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/modules` | optional | List modules (+ user's progress % when authed) |
| GET | `/modules/{slug}` | optional | Module detail: lessons, labs, quiz summary |
| GET | `/modules/{slug}/lessons/{lesson_slug}` | optional | Lesson markdown body |
| POST | `/modules/{slug}/lessons/{lesson_slug}/complete` | ✅ | Mark lesson complete (idempotent, +10 XP first time) |

```jsonc
// GET /modules → 200
[ { "slug": "docker", "title": "Docker", "icon": "🐳", "difficulty": "beginner",
    "est_hours": 6, "lessons": 8, "labs": 2, "progress_pct": 42.5 }, … ]
```

## 3. Quiz Engine

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/modules/{slug}/quiz` | ✅ | Quiz metadata + questions **without answers/explanations** |
| POST | `/quizzes/{quiz_id}/attempts` | ✅ | Start attempt (snapshots quiz version) |
| POST | `/attempts/{attempt_id}/submit` | ✅ | Submit all answers, get graded result |
| GET | `/attempts/{attempt_id}` | ✅ | Review a past graded attempt |
| GET | `/quizzes/{quiz_id}/attempts` | ✅ | My attempt history for a quiz |

```jsonc
// GET /modules/docker/quiz → 200  (note: no correct answers leak pre-submit)
{ "quiz_id": "…", "title": "Docker Mastery Quiz", "pass_threshold": 70,
  "questions": [
    { "id": "…", "external_id": "docker-q01", "qtype": "mcq", "difficulty": "beginner",
      "prompt": "Which command lists running containers?",
      "options": ["docker ps", "docker ls", "docker images", "docker run"] },
    { "id": "…", "qtype": "command", "prompt": "Write the command to …" }  // no options
  ] }

// POST /attempts/{id}/submit
{ "answers": [
    { "question_id": "…", "index": 0 },
    { "question_id": "…", "bool": true },
    { "question_id": "…", "text": "docker exec -it web sh" }
  ] }
// 200 →
{ "score_pct": 86.7, "passed": true, "xp_awarded": 60,
  "results": [
    { "question_id": "…", "correct": true,
      "correct_answer": { "index": 0 },
      "explanation": "`docker ps` lists running containers; add `-a` to include stopped ones." }
  ],
  "new_badges": [ { "slug": "docker-master", "title": "Docker Master" } ] }
```

**Grading rules** (server-side only):
- `mcq`/`scenario`: `answer.index == correct_index`
- `true_false`: `answer.bool == correct_bool`
- `command`: whitespace-normalized `answer.text` ∈ `accepted_answers` (lowercased unless `case_sensitive`)

## 4. Lab Engine

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/modules/{slug}/labs` | ✅ | Labs for a module |
| GET | `/labs/{lab_id}` | ✅ | Lab intro + steps (instructions, hints; expected commands **excluded**) |
| POST | `/labs/{lab_id}/steps/{step_no}/verify` | ✅ | Verify a typed command; enforces step order; +5 XP |
| POST | `/labs/{lab_id}/sessions` | ✅ | (container mode) start sandbox, returns WebSocket URL |
| DELETE | `/labs/sessions/{session_id}` | ✅ | (container mode) tear down sandbox |

```jsonc
// POST /labs/{id}/steps/3/verify
{ "command": "docker build -t myapp:v1 ." }
// 200 → { "correct": true, "mock_output": "Successfully tagged myapp:v1", "next_step": 4 }
// 200 → { "correct": false, "hint": "Remember the -t flag tags the image." }
```

## 5. Progress, Badges, Leaderboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/progress` | ✅ | Per-module % + totals (drives dashboard) |
| GET | `/progress/activity?limit=20` | ✅ | Recent activity feed |
| GET | `/badges` | ✅ | All badges + which I've earned |
| GET | `/leaderboard?window=weekly` | ✅ | Top users by XP |

## 6. Admin (role: `admin`)

| Method | Path | Description |
|---|---|---|
| POST | `/admin/seed` | Re-run content seeder (idempotent upsert from `content/`) |
| GET | `/admin/users?page=` | List users |
| PATCH | `/admin/users/{id}` | Change role / disable |
| GET | `/admin/stats` | Signups, attempts/day, pass rates per module |

## 7. Ops

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | DB connectivity check |
| GET | `/metrics` | Prometheus metrics |

## 8. Conventions

- Pagination: `?page=1&per_page=20` → `X-Total-Count` header.
- Idempotent completion endpoints return `200` with `"already_completed": true` on repeats.
- Rate limits: auth endpoints 10/min/IP; quiz submit 30/min/user.
- Versioning: path-based (`/api/v1`); breaking changes → `/api/v2`.
