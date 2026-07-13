# Jenkins

## Overview

Jenkins is the most widely deployed self-hosted automation server. It executes CI/CD
pipelines defined as code (Jenkinsfiles), scales across build agents, and integrates with
virtually everything via ~1,900 plugins. Even in a GitHub-Actions world, huge enterprises run
their delivery on Jenkins — knowing it is table stakes.

**Prerequisites:** Linux, Git, Docker. **Estimated time:** 6 hours.

## Key Concepts

### Architecture
- **Controller** — schedules builds, serves the UI, stores config. Should not run builds.
- **Agents (nodes)** — machines/containers that execute pipeline work; connected via SSH,
  JNLP, or spun up on demand (Docker/Kubernetes plugin).
- **Executors** — parallel build slots per agent.
- **Workspace** — per-job directory on the agent where the repo is checked out.

### Declarative Jenkinsfile (the standard)
```groovy
pipeline {
  agent { docker { image 'node:20' } }   // build inside a container = clean env
  options { timeout(time: 20, unit: 'MINUTES') }
  environment { CI = 'true' }
  stages {
    stage('Install') { steps { sh 'npm ci' } }
    stage('Test')    { steps { sh 'npm test -- --reporter junit' } }
    stage('Build')   { steps { sh 'npm run build' } }
    stage('Deploy') {
      when { branch 'main' }             // only on main
      steps {
        withCredentials([string(credentialsId: 'deploy-token', variable: 'TOKEN')]) {
          sh './deploy.sh'
        }
      }
    }
  }
  post {
    always  { junit 'reports/**/*.xml' }
    failure { slackSend channel: '#builds', message: "FAILED: ${env.JOB_NAME} ${env.BUILD_NUMBER}" }
  }
}
```
Key blocks: `agent` (where), `stages/steps` (what), `when` (conditions), `environment`,
`post` (always/success/failure hooks), `options` (timeouts, retries).

### Declarative vs Scripted
Declarative = opinionated structure, validation, easier reviews — use it by default.
Scripted (`node { ... }`) = raw Groovy for edge cases.

### Triggers
- **Webhook** from GitHub/GitLab on push/PR (preferred — instant).
- `pollSCM('H/5 * * * *')` — poll as fallback.
- `cron('H 2 * * *')` — nightly jobs. `H` spreads load by hashing the job name.
- **Multibranch pipeline** — auto-discovers branches & PRs that contain a Jenkinsfile.

### Credentials
Store secrets in Jenkins Credentials (or better: an external vault), inject with
`withCredentials`. Values are masked in logs. **Never** echo secrets or put them in the
Jenkinsfile.

### Shared libraries
Reusable pipeline code loaded with `@Library('platform-lib')` — how platform teams give every
service the same standardized `buildAndDeploy()` step.

## Real-World Examples

**1. Monorepo PR pipeline.** Multibranch pipeline builds every PR: lint + unit tests in
parallel stages, integration tests only when `when { changeset "services/api/**" }` matches —
PR feedback drops from 25 to 8 minutes.

**2. Nightly security scan.** `cron('H 3 * * *')` job runs dependency and image scans,
publishes an HTML report, and opens Jira tickets for criticals via a shared-library step.

**3. Controller as pet → cattle.** A team loses a hand-configured controller. Rebuild takes
days. Afterwards: Jenkins runs in Docker, config as code (JCasC plugin), jobs restored from
Jenkinsfiles in Git — a controller rebuild becomes a 20-minute, scripted event.

**4. Flaky agent diagnosis.** Builds fail only on agent `linux-3` with disk errors.
`Manage Nodes` → mark offline, builds reschedule to healthy agents, fix disk, bring it back.

## Step-by-Step Exercises

**Exercise 1 — Local Jenkins.** Run `docker run -d -p 8081:8080 -v jenkins_home:/var/jenkins_home
jenkins/jenkins:lts`, unlock with the initial admin password from the container logs, install
suggested plugins.

**Exercise 2 — First pipeline.** Create a Pipeline job with a 3-stage Jenkinsfile
(checkout → test → package) against a sample repo. Break the test on purpose; watch the
stage view mark the failure and inspect the console log.

**Exercise 3 — Conditional deploy.** Add a `Deploy` stage gated by `when { branch 'main' }`
and a `post { failure { ... } }` notification. Verify a feature branch skips deploy.

**Exercise 4 — Credentials.** Add a secret-text credential `demo-token`, use
`withCredentials` to consume it, and confirm the value is masked as `****` in console output.
