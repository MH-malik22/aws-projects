# CI/CD Concepts

## Overview

CI/CD is the tool-agnostic discipline behind Jenkins, GitHub Actions, GitLab CI and friends:
integrate changes continuously, keep the codebase releasable at all times, and deploy through
an automated, repeatable path. This module covers the concepts you'll apply in *any* tool.

**Prerequisites:** Git; Docker helpful. **Estimated time:** 5 hours.

## Key Concepts

### The three C's
| Term | Meaning | Human gate? |
|---|---|---|
| **Continuous Integration** | Merge to mainline at least daily; every change builds + tests automatically | — |
| **Continuous Delivery** | Every green build produces a deployable artifact; releases are a button-press | Yes, before prod |
| **Continuous Deployment** | Green builds flow to production automatically | No |

### Anatomy of a pipeline
```
commit → lint → unit tests → build artifact → integration tests
       → publish (image/pkg) → deploy staging → e2e/smoke → deploy prod → verify
```
Principles:
- **Fail fast:** cheapest checks first; a lint error shouldn't wait on a 20-min e2e suite.
- **Build once, promote many:** the *same* artifact (image digest) moves dev → staging → prod.
  Rebuilding per environment invalidates everything you tested.
- **Everything as code:** pipeline definitions live in the repo, reviewed like code.
- **Reproducibility:** pinned dependencies, hermetic builds, no snowflake build servers.

### Testing pyramid in CI
Many fast **unit** tests (every commit) → fewer **integration** tests (real DB in a container)
→ few **e2e** tests (critical user journeys) → **smoke** tests post-deploy.
Flaky tests are pipeline poison: quarantine and fix, never `retry: 3` and forget.

### Deployment strategies
| Strategy | How | Rollback | Cost |
|---|---|---|---|
| Rolling | Replace instances in batches | Redeploy old version | Low |
| **Blue-green** | Two full environments; switch traffic atomically | Switch back (instant) | 2× infra |
| **Canary** | Route 1→5→25→100% to new version, watching metrics | Shift traffic back | Medium |
| Feature flags | Deploy dark, enable per user/segment | Toggle off (no deploy) | Code complexity |

Decouple **deploy** (bits on servers) from **release** (users see it) — flags give you that.

### Secrets & security in pipelines
Secrets come from a manager (Vault, cloud secret stores) at runtime, masked in logs, never in
the repo. Add SAST/dependency/image scanning as pipeline stages ("shift left"). Sign artifacts;
pin third-party actions/plugins.

### DORA metrics — how you know it's working
1. **Deployment frequency**
2. **Lead time for changes** (commit → prod)
3. **Change failure rate**
4. **Mean time to restore (MTTR)**

Elite teams deploy on demand, restore in under an hour — enabled by small batches and
automated pipelines, not heroics.

## Real-World Examples

**1. From release weekends to Tuesday afternoons.** A team shipping monthly big-bang releases
(with rollback horror) moves to trunk-based development + feature flags: deploys become daily
non-events; the flag, not the deploy, launches the feature.

**2. Canary catches what staging can't.** A memory leak only appears at production traffic.
The canary at 5% shows RSS climbing; automation shifts traffic back; blast radius: 5% of users
for 4 minutes. Staging would never have caught it.

**3. Build-once discipline pays off.** Team A rebuilds per environment and hits a "works in
staging, broken in prod" from a newer transitive dependency in the prod build. Team B promotes
one image digest through environments; the class of bug simply doesn't exist.

**4. The 40-minute pipeline nobody waits for.** Devs batch changes to avoid the wait —
batches grow, failures get harder to bisect. Fix: parallelize suites, cache dependencies,
move e2e post-merge. At 8 minutes, small PRs return, failure isolation improves.

## Step-by-Step Exercises

**Exercise 1 — Map your pipeline.** Diagram commit → prod for an app you know: stages,
duration, manual gates. Identify the slowest stage and one flaky point.

**Exercise 2 — Build a minimal CI.** In any CI tool, create a pipeline for a sample app:
lint + test + build stages with correct fail-fast ordering. Break a test; verify the build
artifact stage is skipped.

**Exercise 3 — Design a canary rollout.** For a payment service: rollout percentages, the 3
metrics that gate promotion (error rate, p99 latency, business KPI), auto-rollback thresholds,
and bake time per step. Write it as a one-page runbook.

**Exercise 4 — Compute DORA.** From your Git/deploy history (or invented data), compute all
four metrics for the last month and propose the single highest-leverage improvement.
