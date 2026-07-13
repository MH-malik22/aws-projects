# Database Schema (PostgreSQL 16)

Canonical DDL: [`backend/db/schema.sql`](../backend/db/schema.sql). This document explains the design.

## 1. Entity-Relationship Overview

```
users ─┬─< refresh_tokens
       ├─< lesson_progress >── lessons >── modules
       ├─< lab_progress    >── lab_steps >── labs >── modules
       ├─< quiz_attempts ──< attempt_answers >── questions >── quizzes >── modules
       ├─< user_quiz_scores >── quizzes
       ├─< user_badges >── badges
       └─< activity_log
```

## 2. Table Groups

| Group | Tables | Purpose |
|---|---|---|
| Auth | `users`, `refresh_tokens` | Accounts, roles, revocable refresh tokens (stored hashed) |
| Curriculum | `modules`, `lessons` | 11 modules; lesson bodies are markdown seeded from `content/` |
| Quiz | `quizzes`, `questions`, `quiz_attempts`, `attempt_answers`, `user_quiz_scores` | Versioned quiz banks, per-attempt answer records, best-score cache |
| Labs | `labs`, `lab_steps`, `lab_progress` | Simulated or container labs; per-step completion |
| Gamification | `badges`, `user_badges`, `activity_log` | Rule-driven badges, XP ledger, streak source |
| Aggregation | `module_progress` (view) | % complete per user per module for the dashboard |

## 3. Key design decisions

- **Polymorphic questions in one table.** `qtype ∈ {mcq, true_false, scenario, command}` with
  nullable type-specific columns (`correct_index`, `correct_bool`, `accepted_answers` JSONB).
  One table keeps grading a single query; JSONB holds options and accepted command variants.
- **Stable `external_id` per question** (`linux-q07`) so re-seeding content updates in place
  instead of duplicating, while `quizzes.version` + `quiz_attempts.quiz_version` snapshot
  which revision an attempt was graded against.
- **Best-score cache** (`user_quiz_scores`) avoids `MAX()` over attempts on every dashboard load.
- **`activity_log` as XP ledger.** `users.xp` is a denormalized running total; the log is the
  audit trail and feeds streak badges (`COUNT(DISTINCT created_at::date)` over a window).
- **Badges are data, not code.** `badges.rule` JSONB, e.g.:

```json
{"type": "first_quiz_pass"}
{"type": "module_mastery", "module_slug": "docker"}
{"type": "streak_days", "days": 7}
{"type": "labs_completed", "count": 10}
{"type": "xp_reached", "xp": 1000}
```

  A small evaluator runs after each progress write; adding a badge is an INSERT.
- **`module_progress` view** computes `% = (lessons done + lab steps done + quiz passed) / (totals + 1)`
  with LATERAL joins — one query renders the whole dashboard grid.

## 4. Indexing

| Index | Serves |
|---|---|
| `users.email` unique (CITEXT) | login lookup, case-insensitive |
| `idx_attempts_user_quiz` | attempt history, best-score recompute |
| `idx_activity_user_time` | dashboard feed, streak calc |
| PKs on join tables (`user_id, x_id`) | idempotent progress upserts |

## 5. Migration strategy

Alembic owns the live schema; `schema.sql` is regenerated from migrations in CI
(`alembic upgrade head && pg_dump --schema-only`) and diff-checked so docs never drift.
