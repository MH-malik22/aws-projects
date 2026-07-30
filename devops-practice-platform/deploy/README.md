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

## Seeding vs. migrations

- **Migrations** (`npm run migrate`) create tables `IF NOT EXISTS` — idempotent,
  run on every API start.
- **Seed** (`npm run seed`) reloads module content and **truncates** the module
  tables, so it must *not* run on every replica start (it would reset learner
  progress). Run it on first deploy and after content changes:
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

- Burstable `B1ms` Postgres + two scale-to-zero Container Apps + Basic ACR is a
  low-cost footprint for light use. Set the apps' `--min-replicas 0` to avoid
  idle compute charges (the DB bills continuously).
- **Custom domain + free managed cert:**
  ```bash
  az containerapp hostname add  -n devops-web -g devops-platform-rg --hostname www.example.com
  az containerapp hostname bind -n devops-web -g devops-platform-rg --hostname www.example.com \
    --environment devops-aca-env --validation-method CNAME
  ```
- **Tear it all down:** `az group delete -n devops-platform-rg --yes`
