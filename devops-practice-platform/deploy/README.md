# Deploying to Azure

Host the DevOps Practice Platform on **Azure Container Apps** with a managed
**PostgreSQL Flexible Server** and images in **Azure Container Registry** — the
best fit for this containerized 3-tier app (serverless containers, HTTPS
ingress, scale-to-zero, no servers to manage).

```
Browser ──HTTPS──▶ web  (Container App, nginx:80)      ← React SPA
        ──HTTPS──▶ api  (Container App, node:4000) ──▶ PostgreSQL Flexible Server
                          ▲
                     images from ACR
```

## Contents

| File | Purpose |
|------|---------|
| `bicep/main.bicep` | Infrastructure as code: ACR, PostgreSQL (+ db, + firewall), Log Analytics, Container Apps environment |
| `deploy.sh` | One-command deploy: runs the Bicep, builds images in ACR, creates the two Container Apps, wires CORS, seeds once |
| `../../.github/workflows/deploy-devops-platform.yml` | CI/CD: builds + rolls both apps on every push to `master` |

## Prerequisites

- An Azure subscription and the **Azure CLI** installed and logged in:
  ```bash
  az login
  az extension add -n containerapp --upgrade
  ```
- No local Docker required — images are built in the cloud via `az acr build`.

## One-command deploy

From the `devops-practice-platform/` directory.

**macOS / Linux / Git Bash / WSL** (Bash):
```bash
PG_PASSWORD='Str0ng_Passw0rd!' ./deploy/deploy.sh
```

**Windows PowerShell** (no bash needed):
```powershell
./deploy/deploy.ps1 -PgPassword 'Str0ng_Passw0rd!'
```
If PowerShell blocks the script ("running scripts is disabled"):
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -PgPassword 'Str0ng_Passw0rd!'
```

> Note: `VAR=value ./script` is Bash syntax and does **not** work in PowerShell —
> use `deploy.ps1` (which takes `-PgPassword`) on Windows.

It prints the live URLs at the end:

```
 Web UI : https://devops-web.<region>.azurecontainerapps.io
 API    : https://devops-api.<region>.azurecontainerapps.io/api
```

Override defaults with env vars: `LOCATION`, `RG`, `NAME_PREFIX`, `PG_ADMIN`,
`IMAGE_TAG`, `SEED`.

### What it does (and why the order matters)

1. Deploys `main.bicep` → ACR, PostgreSQL, Container Apps environment.
2. Builds the **api** image and creates the `devops-api` app. Its startup command
   is `npm run migrate && npm start` — migrations are idempotent and safe on
   every start.
3. Reads the API's public URL, then builds the **web** image with
   `VITE_API_BASE_URL` baked in (the frontend's API URL is fixed at build time,
   so the web image must be built *after* the API exists).
4. Creates the `devops-web` app and points the API's `CORS_ORIGIN` at it.
5. Runs the content seed **once** (`npm run seed`).

## Seeding vs. migrations (self-initializing container)

The API app is deployed with `INIT_DB=true`, so it prepares its own database on
startup — no fragile startup-command override, no separate seed step:

- **Schema** is applied on every start (idempotent — `CREATE TABLE IF NOT EXISTS`).
- **Content is seeded only when the modules table is empty.** That means the
  first boot seeds all 17 modules, and later restarts/scale events **do not** wipe
  learner progress.

Because seeding is skipped once content exists, **changing `content/*.json` needs
a manual reload** (it truncates and reloads module content):
```bash
az containerapp exec -n devops-api -g devops-platform-rg --command "npm run seed"
```

## PostgreSQL over TLS

Azure Postgres requires SSL. The API enables it when `DATABASE_SSL=true` (set by
the script) or when the connection string contains `sslmode=require` — see
`server/src/db/pool.js`. It accepts the managed cert without bundling a CA; set
`PGSSLROOTCERT` if you want strict verification.

## CI/CD with GitHub Actions

After the first `deploy.sh` run, wire up automatic deploys on push to `master`.

**Repository → Settings → Secrets and variables → Actions**

Secrets:
- `AZURE_CLIENT_ID` — client id of an Azure AD app registration with a federated
  (OIDC) credential for this repo
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Variable:
- `ACR_NAME` — the registry name printed by `deploy.sh`

Grant the service principal **Contributor** + **AcrPush** on the resource group.
Quick setup:

```bash
# create app + service principal
appId=$(az ad app create --display-name devops-platform-cicd --query appId -o tsv)
az ad sp create --id "$appId"

# federated credential for pushes to master
az ad app federated-credential create --id "$appId" --parameters '{
  "name": "gh-master",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:MH-malik22/aws-projects:ref:refs/heads/master",
  "audiences": ["api://AzureADTokenExchange"]
}'

# role assignment on the resource group
sub=$(az account show --query id -o tsv)
az role assignment create --assignee "$appId" --role Contributor \
  --scope "/subscriptions/$sub/resourceGroups/devops-platform-rg"
az role assignment create --assignee "$appId" --role AcrPush \
  --scope "/subscriptions/$sub/resourceGroups/devops-platform-rg"
```

Then every push to `master` under `devops-practice-platform/**` builds both
images and rolls the apps. The workflow does **not** re-seed (to protect learner
progress) — seed manually after content changes.

## Cost & cleanup

- **Deploys cost-optimized by default:** both Container Apps use
  `min-replicas 0`, so they scale to zero and cost ~nothing when idle (light
  traffic stays within the monthly free grant). The trade-off is a few-second
  **cold start** on the first request after idle. To keep them always-warm,
  deploy with `-MinReplicas 1` (PowerShell) or `MIN_REPLICAS=1` (Bash). The
  deploy sends a warm-up request so the first-boot seed still happens during
  deploy, not on your first visit.
- The **database bills continuously** (Burstable `B1ms` ≈ $13–15/mo + ~$4
  storage) — it can't scale to zero. Stop it when idle to pay storage only:
  ```bash
  az postgres flexible-server stop  -g devops-platform-rg -n <pg-name>
  az postgres flexible-server start -g devops-platform-rg -n <pg-name>
  ```
- Basic ACR is ~$5/mo fixed. Rough all-in: **~$18–22/mo** left running,
  **~$9–12/mo** with the DB stopped between sessions, **~$0** if you delete the
  group and redeploy on demand.
- **Custom domain + free managed cert:**
  ```bash
  az containerapp hostname add  -n devops-web -g devops-platform-rg --hostname www.example.com
  az containerapp hostname bind -n devops-web -g devops-platform-rg --hostname www.example.com \
    --environment devops-aca-env --validation-method CNAME
  ```
- **Tear it all down:** `az group delete -n devops-platform-rg --yes`
