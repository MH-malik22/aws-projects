-- DevOps Academy — PostgreSQL 16 schema (canonical DDL)
-- Applied by Alembic in practice; kept here as the single readable source of truth.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";    -- case-insensitive email

-- ─────────────────────────── Users & Auth ───────────────────────────

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin')),
    xp            INTEGER NOT NULL DEFAULT 0,
    theme_pref    TEXT NOT NULL DEFAULT 'system' CHECK (theme_pref IN ('light','dark','system')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,              -- SHA-256 of the opaque token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─────────────────────────── Curriculum ───────────────────────────

CREATE TABLE modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,        -- 'linux', 'docker', 'kubernetes' …
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    icon        TEXT NOT NULL DEFAULT '',    -- emoji / icon key for UI
    difficulty  TEXT NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced')),
    sort_order  INTEGER NOT NULL,
    est_hours   NUMERIC(4,1) NOT NULL DEFAULT 4.0,
    published   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE lessons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    slug        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body_md     TEXT NOT NULL,               -- markdown content
    sort_order  INTEGER NOT NULL,
    UNIQUE (module_id, slug)
);

-- ─────────────────────────── Quiz Engine ───────────────────────────

CREATE TABLE quizzes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id      UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    pass_threshold INTEGER NOT NULL DEFAULT 70,   -- percent
    version        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE questions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id          UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    external_id      TEXT NOT NULL,               -- stable id from content JSON, e.g. 'linux-q07'
    qtype            TEXT NOT NULL CHECK (qtype IN ('mcq','true_false','scenario','command')),
    difficulty       TEXT NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced')),
    prompt           TEXT NOT NULL,
    options          JSONB,                       -- ["opt A","opt B",…] for mcq/scenario
    correct_index    INTEGER,                     -- mcq/scenario
    correct_bool     BOOLEAN,                     -- true_false
    accepted_answers JSONB,                       -- ["git rebase -i HEAD~3", …] for command
    case_sensitive   BOOLEAN NOT NULL DEFAULT FALSE,
    explanation      TEXT NOT NULL,
    sort_order       INTEGER NOT NULL,
    UNIQUE (quiz_id, external_id)
);

CREATE TABLE quiz_attempts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id      UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_version INTEGER NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    score_pct    NUMERIC(5,2),
    passed       BOOLEAN
);
CREATE INDEX idx_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);

CREATE TABLE attempt_answers (
    attempt_id     UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_payload JSONB NOT NULL,   -- {"index":2} | {"bool":true} | {"text":"kubectl get pods"}
    is_correct     BOOLEAN NOT NULL,
    PRIMARY KEY (attempt_id, question_id)
);

-- ─────────────────────────── Lab Engine ───────────────────────────

CREATE TABLE labs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    slug          TEXT NOT NULL,
    title         TEXT NOT NULL,
    intro_md      TEXT NOT NULL,
    mode          TEXT NOT NULL DEFAULT 'simulated' CHECK (mode IN ('simulated','container')),
    image         TEXT,                        -- container mode: sandbox image
    verify_script TEXT,                        -- container mode: in-sandbox verification
    sort_order    INTEGER NOT NULL,
    UNIQUE (module_id, slug)
);

CREATE TABLE lab_steps (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id            UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    step_no           INTEGER NOT NULL,
    instruction_md    TEXT NOT NULL,
    expected_commands JSONB NOT NULL DEFAULT '[]',  -- literals or /regex/ strings
    mock_output       TEXT NOT NULL DEFAULT '',
    hint              TEXT,
    UNIQUE (lab_id, step_no)
);

-- ─────────────────────────── Progress ───────────────────────────

CREATE TABLE lesson_progress (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE lab_progress (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_step_id  UUID NOT NULL REFERENCES lab_steps(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lab_step_id)
);

CREATE TABLE user_quiz_scores (          -- best score per user per quiz
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id    UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    best_pct   NUMERIC(5,2) NOT NULL,
    passed     BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, quiz_id)
);

-- ─────────────────────────── Badges & Achievements ───────────────────────────

CREATE TABLE badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,     -- 'first-quiz', 'docker-master', 'streak-7' …
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    icon        TEXT NOT NULL,
    rule        JSONB NOT NULL            -- {"type":"quiz_pass","module":"docker"} …
);

CREATE TABLE user_badges (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id   UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE activity_log (              -- powers streaks + dashboard feed
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,            -- 'lesson_done','lab_step','quiz_pass','badge' …
    ref_id     UUID,
    xp_delta   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user_time ON activity_log(user_id, created_at DESC);

-- ─────────────────────────── Aggregation view ───────────────────────────

CREATE VIEW module_progress AS
SELECT
    u.id AS user_id,
    m.id AS module_id,
    m.slug,
    COALESCE(l.done, 0)  AS lessons_done,
    COALESCE(l.total, 0) AS lessons_total,
    COALESCE(s.done, 0)  AS lab_steps_done,
    COALESCE(s.total, 0) AS lab_steps_total,
    COALESCE(q.passed, FALSE) AS quiz_passed,
    ROUND(
      100.0 * (COALESCE(l.done,0) + COALESCE(s.done,0) + (CASE WHEN COALESCE(q.passed,FALSE) THEN 1 ELSE 0 END))
      / NULLIF(COALESCE(l.total,0) + COALESCE(s.total,0) + 1, 0), 1
    ) AS pct
FROM users u
CROSS JOIN modules m
LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE lp.user_id IS NOT NULL) AS done, COUNT(*) AS total
    FROM lessons le
    LEFT JOIN lesson_progress lp ON lp.lesson_id = le.id AND lp.user_id = u.id
    WHERE le.module_id = m.id
) l ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE gp.user_id IS NOT NULL) AS done, COUNT(*) AS total
    FROM labs la JOIN lab_steps ls ON ls.lab_id = la.id
    LEFT JOIN lab_progress gp ON gp.lab_step_id = ls.id AND gp.user_id = u.id
    WHERE la.module_id = m.id
) s ON TRUE
LEFT JOIN LATERAL (
    SELECT BOOL_OR(uq.passed) AS passed
    FROM quizzes qz LEFT JOIN user_quiz_scores uq ON uq.quiz_id = qz.id AND uq.user_id = u.id
    WHERE qz.module_id = m.id
) q ON TRUE;

COMMIT;
