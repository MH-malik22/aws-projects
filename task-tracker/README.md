# Task Tracker with Auto Reminders

A lightweight JavaScript application to track day-to-day tasks and automatically
remind you about them before they are due. Runs entirely in the browser - no
build step, no backend, no dependencies.

## Features

- Add tasks with title, notes, due date/time, priority, and category
- Auto-reminders fire in two stages per task:
  - **Pre-reminder:** configurable minutes before the due time (default 10)
  - **Due notification:** exactly at the due time
- Recurring tasks (daily, weekly, monthly) that auto-roll to the next due date
- Snooze any task by 10 minutes with one click
- Mark tasks complete, delete tasks, or clear all completed
- Filter by *All / Pending / Completed / Overdue / Due today*
- Uses the browser **Notifications API**. Falls back to a flashing tab title
  if notifications are blocked or not granted.
- Persists tasks in `localStorage` - your tasks survive page reloads

## Getting started

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
   - Tip: Some browsers require the page to be served over `http(s)://` or
     `file://` for notifications. If notifications don't work from `file://`,
     serve the folder with a quick static server:
     ```bash
     # from the task-tracker directory
     python3 -m http.server 8000
     # then visit http://localhost:8000
     ```
2. Click **Enable Notifications** and allow the browser prompt.
3. Add a task with a due date. Leave the tab open and reminders will fire
   automatically.

## Project structure

```
task-tracker/
├── index.html        # App shell and form markup
├── css/
│   └── styles.css    # Dark-mode friendly styles
└── js/
    ├── storage.js    # localStorage helpers (load/save/id)
    ├── reminders.js  # Scheduler, notifications, recurring rollover
    └── app.js        # DOM wiring, rendering, event handlers
```

## How the reminder scheduler works

The scheduler runs on a 30-second interval (see `Reminders.start` in
`js/reminders.js`). On each tick it walks through the task list and, for every
non-completed task, checks:

1. **Pre-reminder** — if `now >= dueAt - remindBefore` and we have not yet
   fired the pre-reminder for this task, a notification is shown and the task
   is flagged so it is not fired again.
2. **Due notification** — if `now >= dueAt` and the due notification has not
   yet fired, a notification is shown. If the task is recurring, its `dueAt`
   is advanced (daily / weekly / monthly) and the reminder flags are reset so
   the next occurrence can fire its own reminders.

Snoozing a task simply pushes `dueAt` forward by 10 minutes and clears the
reminder flags.

## Limitations

- Reminders only fire while the tab is open. For true background reminders a
  Service Worker and the `showNotification` API would be required; that can be
  added as a follow-up.
- `localStorage` is per-browser, per-origin. Tasks are not synced across
  devices.

## License

Part of the `aws-projects` repository.
