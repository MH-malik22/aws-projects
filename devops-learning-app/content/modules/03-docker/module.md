# Docker & Containers

## Overview

Containers package an app with its dependencies into a portable, isolated unit that runs the
same on a laptop and in production. Docker is the tool that made them mainstream and remains
the standard build/dev experience; Kubernetes (next modules) orchestrates them at scale.

**You will learn:** the image/container model, writing production-grade Dockerfiles, networking,
persistent data, multi-container apps with Compose, and debugging running containers.

**Prerequisites:** Linux, Git. **Estimated time:** 8 hours.

## Key Concepts

### Images vs containers
- **Image** = immutable, layered filesystem + metadata (a class).
- **Container** = a running (or stopped) instance of an image with a writable layer (an object).
- Layers are cached and shared: 10 containers from one image reuse the same read-only layers.

### Container ≠ VM
Containers share the host kernel; isolation comes from **namespaces** (what a process can see)
and **cgroups** (what it can use). Startup is milliseconds, overhead is ~zero — but kernel
exploits are a shared risk, hence sandboxing and minimal images.

### Daily commands
```bash
docker run -d -p 8080:80 --name web nginx:1.27   # detached, port host:container
docker ps -a                # containers (all states)
docker logs -f web          # follow logs
docker exec -it web sh      # shell into a running container
docker stop web && docker rm web
docker images; docker rmi nginx:1.27
docker system prune -af     # reclaim disk (careful!)
```

### Dockerfile essentials
```dockerfile
# Multi-stage: build with the SDK, ship only the runtime
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                  # cache-friendly: deps layer changes rarely
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node                   # never run as root in prod
EXPOSE 3000
CMD ["node", "dist/server.js"]
```
Rules that matter in production:
1. **Order layers by change frequency** — copy manifests, install deps, *then* copy source.
2. **Multi-stage builds** keep compilers/SDKs out of the final image.
3. **Pin base image tags** (`node:20.15-slim`, not `latest`).
4. **Run as non-root**; add a `HEALTHCHECK`.
5. `.dockerignore` (node_modules, .git) — smaller context, faster builds, no secret leaks.

### Networking & data
```bash
docker network create appnet
docker run -d --network appnet --name db postgres:16
docker run -d --network appnet -e DB_HOST=db myapp   # DNS by container name
docker volume create pgdata
docker run -v pgdata:/var/lib/postgresql/data postgres:16   # survives container removal
```

### Docker Compose
```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://devops:devops@db:5432/app
    depends_on: [db]
  db:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: devops
      POSTGRES_PASSWORD: devops
volumes:
  pgdata:
```
`docker compose up -d`, `docker compose logs -f api`, `docker compose down` — the standard
local dev stack.

## Real-World Examples

**1. "Works on my machine" eliminated.** A Python app needs libpq, Python 3.12 and specific
wheels. The Dockerfile encodes all of it; CI builds one image that dev, staging and prod all run.

**2. Image bloat audit.** A team's image is 2.1 GB and deploys take minutes. Switching to
multi-stage + `python:3.12-slim` + `.dockerignore` cuts it to 180 MB — faster pulls, smaller
attack surface, cheaper registry storage.

**3. Debugging a crash-looping container.** `docker ps -a` shows Exit 137 →
that's SIGKILL, almost always the OOM killer. `docker stats` confirms the memory ceiling;
fix the leak or raise `--memory`.

**4. Database survives redeploys.** Postgres data on a named volume: `docker compose down &&
up` recreates containers but the volume — and your data — persists.

## Step-by-Step Exercises

**Exercise 1 — Run & inspect.** Run nginx detached on host port 8080, curl it, follow its
logs, exec a shell inside, find the config at `/etc/nginx/nginx.conf`, stop and remove it.

**Exercise 2 — Containerize an app.** Write a Dockerfile for a small Flask/Express app.
Build `myapp:v1`, run it, prove code changes require a rebuild (immutability).

**Exercise 3 — Layer-cache experiment.** Put `COPY . .` *before* dependency install; time
rebuilds after a source edit. Reorder correctly and compare. Explain the difference.

**Exercise 4 — Compose stack.** Write a compose file with an API + Postgres + named volume.
Bring it up, write data, `docker compose down`, bring it back up, verify data survived.

**Exercise 5 — Slim it.** Convert Exercise 2 to a multi-stage build on a slim base with a
non-root user. Compare `docker images` sizes before/after.
