-- DevOps Practice Platform — PostgreSQL schema
-- Run via `npm run migrate`. Safe to re-run (idempotent).

CREATE TABLE IF NOT EXISTS modules (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
  concept     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          TEXT PRIMARY KEY,               -- e.g. "docker-q1"
  module_id   INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,               -- order within the module
  type        TEXT NOT NULL CHECK (type IN ('mcq','truefalse','scenario')),
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer      JSONB NOT NULL,                 -- integer index (mcq/scenario) or boolean (truefalse)
  explanation TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_quiz_module ON quiz_questions(module_id);

CREATE TABLE IF NOT EXISTS tasks (
  id               SERIAL PRIMARY KEY,
  module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  level            TEXT NOT NULL CHECK (level IN ('beginner','intermediate','advanced','simulation')),
  title            TEXT NOT NULL,
  goal             TEXT NOT NULL DEFAULT '',
  steps            JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_criteria JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_tasks_module ON tasks(module_id);

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  external_id  TEXT UNIQUE NOT NULL,          -- value from the x-user-id header
  display_name TEXT NOT NULL DEFAULT 'Learner',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  notes_read       BOOLEAN NOT NULL DEFAULT FALSE,
  quiz_best_score  INTEGER NOT NULL DEFAULT 0,   -- best number correct
  quiz_total       INTEGER NOT NULL DEFAULT 0,   -- number of questions at last submit
  quiz_passed      BOOLEAN NOT NULL DEFAULT FALSE,
  tasks_completed  JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of completed task positions
  percent          INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- A shared demo user so the app is usable out of the box without auth.
INSERT INTO users (external_id, display_name)
VALUES ('demo-user', 'Demo Learner')
ON CONFLICT (external_id) DO NOTHING;
