# DevOps Academy — DevOps Learning Application

A full-stack, self-hostable learning platform that teaches every major DevOps tool through
structured modules, hands-on labs, real-world examples, and quiz banks with explained answers.

## 1. High-Level Summary

| Item | Decision |
|---|---|
| Frontend | **Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS** |
| Backend | **Python FastAPI** (async, typed, OpenAPI auto-docs) |
| Database | **PostgreSQL 16** (SQLAlchemy 2.0 + Alembic migrations) |
| Auth | JWT (access + refresh), bcrypt password hashing |
| Lab engine | Simulated terminal (xterm.js) + optional Docker-sandbox executor |
| Quiz engine | Server-graded, versioned quiz banks seeded from `content/` JSON |
| Content | Git-versioned markdown + JSON in [`content/modules/`](content/modules/) — content is data, not code |
| Deployment | Docker Compose (dev), Kubernetes-ready images, GitHub Actions CI/CD |

### Core learning modules (11)

Linux · Git · Docker · Jenkins · Terraform · Kubernetes · Ansible · Helm ·
AWS Basics (IAM, EC2, S3, VPC) · CI/CD Concepts · Monitoring (Prometheus + Grafana)

Each module ships with: overview, key concepts, real-world examples, hands-on labs,
step-by-step exercises, and a quiz bank (MCQ, true/false, scenario, and command questions —
every answer explained).

## 2. Feature List

### Learning
- 11 structured modules with lessons, labs, and exercises
- Markdown-driven content pipeline: edit `content/`, run seeder, content is live
- Simulated terminal labs with expected-command validation
- Optional container-backed real labs (Docker executor with resource limits)

### Assessment
- Quiz engine: multiple-choice, true/false, scenario-based, command-based questions
- Per-answer explanations shown after submission
- Pass threshold per quiz (default 70%), unlimited retakes, best-score tracking

### Progress & Gamification
- Per-lesson / per-lab / per-quiz completion tracking
- Module progress bars and global dashboard
- Badges & achievements (first quiz, module mastery, streaks, lab completions)
- XP system with levels

### Platform
- JWT auth (register / login / refresh / logout), roles: `learner`, `admin`
- Dark / light mode (system-aware, persisted)
- Fully responsive UI, keyboard-accessible quiz interface
- Admin content management via seeder + REST endpoints
- OpenAPI docs at `/docs`, health checks, structured logging

## 3. Repository Layout

```
devops-learning-app/
├── README.md                  ← this file (summary, features, roadmap)
├── docs/
│   ├── 01-architecture.md     ← full application architecture
│   ├── 02-database-schema.md  ← ERD + DDL walkthrough
│   ├── 03-api-design.md       ← every REST endpoint, request/response shapes
│   ├── 04-frontend-ui-ux.md   ← dashboard, module, quiz, lab screens
│   └── 05-roadmap.md          ← build roadmap (phases, milestones)
├── backend/
│   ├── app/                   ← FastAPI application (routers, models, auth, engines)
│   ├── db/schema.sql          ← canonical PostgreSQL DDL
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  ← Next.js app (App Router)
├── content/
│   └── modules/               ← 11 modules: module.md, labs.md, quiz.json each
├── docker-compose.yml         ← full local stack: db + api + web
└── .github/workflows/ci.yml   ← CI/CD for this app (lint, test, build, push images)
```

## 4. Quickstart

```bash
# Full stack (Postgres + API + Web)
docker compose up --build

# API only, local dev
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload           # http://localhost:8000/docs

# Seed modules, lessons, labs, quizzes from content/
python -m app.seed

# Frontend, local dev
cd frontend
npm install && npm run dev              # http://localhost:3000
```

## 5. Build Roadmap (summary)

| Phase | Weeks | Deliverable |
|---|---|---|
| 0 — Foundations | 1 | Repo, CI, Docker Compose, schema migrated |
| 1 — Auth + Content API | 2 | Register/login, modules/lessons served from DB |
| 2 — Quiz Engine | 2 | Attempts, grading, explanations, best scores |
| 3 — Frontend Core | 3 | Dashboard, module pages, quiz UI, dark mode |
| 4 — Progress + Badges | 1 | Tracking, XP, achievements |
| 5 — Lab Engine v1 | 2 | Simulated terminal labs with validation |
| 6 — Lab Engine v2 | 3 | Container-backed real labs (opt-in) |
| 7 — Hardening + Launch | 2 | Load tests, a11y pass, K8s manifests, prod deploy |

Full details: [`docs/05-roadmap.md`](docs/05-roadmap.md)
