# Frontend UI/UX Design

Stack: **Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · SWR · next-themes · xterm.js**

## 1. Route Map

```
app/
├── (public)
│   ├── /                      Landing: value prop, module grid preview, CTA
│   ├── /login                 Login form
│   └── /register              Registration form
├── (authed, sidebar layout)
│   ├── /dashboard             Progress overview, streak, resume cards, activity feed
│   ├── /modules               All-modules grid with progress rings
│   ├── /modules/[slug]        Module home: lesson list, labs, quiz entry
│   ├── /modules/[slug]/lessons/[lesson]   Lesson reader (markdown, prev/next)
│   ├── /modules/[slug]/quiz   Quiz runner → results view
│   ├── /labs/[labId]          Lab: split view — instructions | terminal
│   ├── /achievements          Badge wall (earned vs locked)
│   ├── /leaderboard           Weekly / all-time XP
│   └── /settings              Profile, theme, password
```

## 2. Screen Specs

### Dashboard
```
┌───────────────────────────────────────────────────────────────┐
│ ◧ Sidebar        │  Hello, Dev 👋           🔥 5-day streak    │
│  Dashboard       │  ┌────────┐ ┌────────┐ ┌────────┐          │
│  Modules         │  │ XP 1240│ │ Lvl 3  │ │ 7/11   │  stats   │
│  Achievements    │  │        │ │        │ │ modules│  tiles   │
│  Leaderboard     │  └────────┘ └────────┘ └────────┘          │
│  Settings        │  Continue learning ──────────────────────  │
│  ─────────       │  [▶ Docker — Lab 2: Build an image  64%]   │
│  🌙 theme toggle │  [▶ Kubernetes — Lesson 3           30%]   │
│                  │  Module grid (11 cards, progress rings)    │
│                  │  Recent activity feed                      │
└───────────────────────────────────────────────────────────────┘
```

### Module page
- Header: icon, title, difficulty chip, est. hours, overall progress bar.
- Tabs: **Lessons** (checklist with ✓ states) · **Labs** (cards with step counts) · **Quiz** (best score, attempts, Start/Retake button).

### Quiz interface
- One question per screen, progress dots across the top, question-type chip (MCQ / True-False / Scenario / Command).
- MCQ/scenario: radio cards (large hit areas, keyboard 1–4 + arrows).
- True/false: two large buttons.
- Command: monospace input styled as a terminal line (`$ …`).
- Flag-for-review, back/next; **Submit** shows confirm dialog listing unanswered questions.
- **Results view:** score ring, pass/fail banner, XP toast, then per-question review — your answer vs correct answer with the explanation in a callout. Wrong answers link back to the relevant lesson.

### Lab interface
```
┌────────────────────────────┬──────────────────────────────────┐
│ Step 3 of 7   ●●●○○○○      │  $ docker build -t myapp:v1 .    │
│ Build the image            │  Successfully tagged myapp:v1    │
│ ─ instructions markdown ─  │  $ ▌                             │
│ 💡 Hint (click to reveal)  │        (xterm.js terminal)       │
│ [◀ Prev]        [Skip ▸]   │                                  │
└────────────────────────────┴──────────────────────────────────┘
```
- Correct command → green flash, mock output prints, step auto-advances, +5 XP toast.
- Wrong command → shake animation, hint becomes available after 2 failures.
- Container mode swaps the simulated pane for a live WebSocket PTY with a session timer.

### Achievements
- Grid of badge cards; earned = full color + date, locked = grayscale + progress hint
  ("Complete 3 more labs"). Confetti animation on new badge.

## 3. Component Inventory

| Component | Used in | Notes |
|---|---|---|
| `ModuleCard` | dashboard, /modules | icon, difficulty chip, progress ring |
| `ProgressRing` | cards, quiz results | SVG, animated stroke |
| `LessonReader` | lesson page | markdown → styled prose, code blocks w/ copy button |
| `QuizRunner` | quiz page | state machine: idle → in-progress → review → submitted |
| `QuestionCard` | QuizRunner | renders per `qtype` |
| `TerminalPane` | labs | xterm.js wrapper; simulated & live modes |
| `BadgeCard`, `XPToast`, `StreakFlame` | gamification | |
| `ThemeToggle` | header | next-themes; `light / dark / system` persisted to API |

## 4. Design System

- **Colors:** Tailwind slate base; brand indigo-600; success emerald-500; danger rose-500.
  Dark mode via `class` strategy — every component styled for both.
- **Type:** Inter (UI), JetBrains Mono (code/terminal).
- **A11y:** all interactive elements keyboard-reachable; quiz answerable without mouse;
  WCAG AA contrast in both themes; `prefers-reduced-motion` disables confetti/shake.
- **State:** SWR for server state (revalidate on focus), React context for auth session,
  quiz answers held locally until submit (survives refresh via `sessionStorage`).
