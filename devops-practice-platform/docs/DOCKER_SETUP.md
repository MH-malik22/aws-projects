# Running the DevOps Practice Platform with Docker

A complete, step-by-step guide to run the whole app — PostgreSQL, the API, and
the web UI — with a single command using Docker Compose.

> TL;DR
> ```bash
> cd devops-practice-platform
> cp .env.example .env          # optional; sensible defaults are baked in
> docker compose up --build
> ```
> Web UI → http://localhost:8080 · API → http://localhost:4000/api
> The API container migrates the schema and seeds all 10 modules automatically.

---

## 1. Prerequisites

Install **Docker** (Docker Desktop on macOS/Windows, or Docker Engine on Linux).
It must include **Compose v2** (the `docker compose` subcommand).

Verify both are present and the daemon is running:

```bash
docker --version          # e.g. Docker version 27.x
docker compose version    # e.g. Docker Compose version v2.x
```

Make sure Docker Desktop (or the Docker daemon on Linux via
`sudo systemctl start docker`) is actually running before continuing.

## 2. Get the code

```bash
git clone https://github.com/MH-malik22/aws-projects.git
cd aws-projects/devops-practice-platform
```

If you already cloned the repo, pull the latest `master` and change into the
app directory:

```bash
git pull origin master
cd devops-practice-platform
```

## 3. (Optional) create the env file

Sensible defaults are baked into `docker-compose.yml`, so this step is optional:

```bash
cp .env.example .env
```

Only edit `.env` if you want to change the database name/password or the
exposed ports. Compose automatically loads a file named `.env` from this
directory.

## 4. Build and start everything

```bash
docker compose up --build
```

This builds the images and starts **three containers**:

| Service | What it is                | Port (host → container) |
|---------|---------------------------|-------------------------|
| `db`    | PostgreSQL 16             | `5432 → 5432`           |
| `api`   | Node/Express REST API     | `4000 → 4000`           |
| `web`   | React SPA served by nginx | `8080 → 80`             |

**What happens automatically:**

1. `db` starts, and Compose waits for its healthcheck (`pg_isready`) to pass.
2. `api` then runs `npm run setup` (applies the schema **and** seeds all 10
   modules), then `npm start`.
3. `web` serves the pre-built React app.

The first build takes a couple of minutes (pulling base images, `npm install`).
Leave the terminal open to watch live logs from all three services.

> To run detached (in the background) instead:
> ```bash
> docker compose up --build -d
> docker compose logs -f          # follow logs
> ```

## 5. Confirm it's up

Watch the `api` logs for these lines — they confirm the database seeded
correctly:

```
[migrate] schema applied successfully
[seed] loading 10 modules ...
[seed] done
[server] DevOps Practice Platform API listening on :4000
```

Then check it:

- **Web UI** → open **http://localhost:8080** — you should see the pipeline
  dashboard with all ten stages (`git` → `sre`).
- **API health:**
  ```bash
  curl http://localhost:4000/api/health
  # {"status":"ok","db":"up"}
  ```
- **API data:**
  ```bash
  curl http://localhost:4000/api/modules
  # returns 10 modules
  ```

Click into a stage (e.g. Docker) → the **Concept / Notes / Quiz / Labs** tabs
should all work, and taking the quiz should advance the stage's progress.

## 6. Everyday commands

```bash
# Stop the stack (Ctrl+C if running in the foreground), or:
docker compose down

# Stop AND wipe the database (fresh start; re-seeds on next up):
docker compose down -v

# Rebuild images after code changes and restart:
docker compose up --build

# Tail logs for a single service:
docker compose logs -f api

# Open a shell inside a running container:
docker compose exec api sh
docker compose exec db psql -U devops -d devops_platform

# Re-run only the content seed (after editing content/*.json):
docker compose exec api npm run seed
```

## 7. Troubleshooting

**Port already in use** (`bind: address already in use` for 8080, 4000, or 5432)
Another process holds that port. Either stop it, or change the host port in
`docker-compose.yml` (e.g. `"9090:80"` for `web`) and re-run. If you remap the
**API** port, also update `VITE_API_BASE_URL` under the `web` service — the
browser calls the API directly at `http://localhost:4000/api`, and that value is
baked in at build time, so rebuild with `--build` afterward.

**Web loads but shows "Could not load modules"**
The API container isn't healthy yet. Check `docker compose logs api` — it's
usually still waiting on the DB or the seed failed. A clean slate fixes most
cases:
```bash
docker compose down -v && docker compose up --build
```

**`docker compose` not found**
You have the old standalone tool — use `docker-compose` (with a hyphen), or
update Docker Desktop to get Compose v2.

**Daemon not running**
Start Docker Desktop, or on Linux: `sudo systemctl start docker`.

**Changed a `content/*.json` and want it reloaded**
Run `docker compose exec api npm run seed`, or `docker compose down -v` followed
by `docker compose up` for a full reset.

---

## How the pieces connect

```
  Browser ──▶ http://localhost:8080  (web: nginx serving the React SPA)
      │
      └─────▶ http://localhost:4000/api  (api: Express, called directly by the browser)
                          │
                          └──▶ db:5432  (postgres, internal Docker network)
```

- The **web** container serves static files only; the browser talks to the
  **API** directly, which is why `VITE_API_BASE_URL` points at
  `http://localhost:4000/api`.
- The **api** container reaches the database over the internal Compose network
  at hostname `db`, using `DATABASE_URL` defined in `docker-compose.yml`.
- Database data persists in the named volume `pgdata` between runs (until you
  `docker compose down -v`).

For the full architecture, data model, and API contract, see
[`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md).
