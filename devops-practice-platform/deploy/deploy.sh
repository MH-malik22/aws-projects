#!/usr/bin/env bash
# =========================================================================
# One-command deploy of the DevOps Practice Platform to Azure Container Apps.
#
#   PG_PASSWORD='Str0ng_Passw0rd!' ./deploy/deploy.sh
#
# Requires: Azure CLI (`az`) logged in (`az login`). No local Docker needed —
# images are built in the cloud with `az acr build`.
#
# Override any of these via environment variables:
#   LOCATION (eastus)  RG (devops-platform-rg)  NAME_PREFIX (devops)
#   PG_ADMIN (devopsadmin)  PG_PASSWORD (required)  IMAGE_TAG (timestamp)
#   SEED (true) — run the one-time content seed after deploy
# =========================================================================
set -euo pipefail

LOCATION="${LOCATION:-eastus}"
RG="${RG:-devops-platform-rg}"
NAME_PREFIX="${NAME_PREFIX:-devops}"
PG_ADMIN="${PG_ADMIN:-devopsadmin}"
PG_PASSWORD="${PG_PASSWORD:-}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
# Cost-optimized by default: apps scale to zero when idle. Set MIN_REPLICAS=1 to
# keep them always-warm (no cold starts, higher cost).
MIN_REPLICAS="${MIN_REPLICAS:-0}"

# Platform root = the parent of this script's directory.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$PG_PASSWORD" ]]; then
  echo "ERROR: set PG_PASSWORD to a strong password before running." >&2
  echo "  e.g. PG_PASSWORD='Str0ng_Passw0rd!' ./deploy/deploy.sh" >&2
  exit 1
fi

echo "==> Resource group: $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Deploying infrastructure via Bicep (ACR, PostgreSQL, Container Apps env)"
az deployment group create \
  -g "$RG" -n devops-infra \
  --template-file "$ROOT/deploy/bicep/main.bicep" \
  --parameters location="$LOCATION" namePrefix="$NAME_PREFIX" \
               pgAdmin="$PG_ADMIN" pgPassword="$PG_PASSWORD" \
  -o none

get_out() { az deployment group show -g "$RG" -n devops-infra --query "properties.outputs.$1.value" -o tsv; }
ACR_NAME="$(get_out acrName)"
ACR_SERVER="$(get_out acrLoginServer)"
ENV_ID="$(get_out environmentId)"
PG_FQDN="$(get_out pgFqdn)"
DB_NAME="$(get_out databaseName)"

DB_URL="postgres://${PG_ADMIN}:${PG_PASSWORD}@${PG_FQDN}:5432/${DB_NAME}?sslmode=require"
ACR_USER="$(az acr credential show -n "$ACR_NAME" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv)"

echo "==> Building API image in ACR (devops-api:${IMAGE_TAG})"
az acr build -r "$ACR_NAME" -t "devops-api:${IMAGE_TAG}" -f "$ROOT/server/Dockerfile" "$ROOT" -o none

echo "==> Deploying API container app"
# INIT_DB=true makes the API apply its schema and seed-if-empty on startup, so
# no fragile startup-command override is needed.
if az containerapp show -n devops-api -g "$RG" -o none 2>/dev/null; then
  az containerapp update -n devops-api -g "$RG" \
    --image "${ACR_SERVER}/devops-api:${IMAGE_TAG}" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 3 \
    --set-env-vars DATABASE_SSL=true PORT=4000 INIT_DB=true -o none
else
  az containerapp create \
    -n devops-api -g "$RG" --environment "$ENV_ID" \
    --image "${ACR_SERVER}/devops-api:${IMAGE_TAG}" \
    --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 4000 --ingress external \
    --min-replicas "$MIN_REPLICAS" --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    --secrets "db-url=$DB_URL" \
    --env-vars DATABASE_URL=secretref:db-url PORT=4000 DATABASE_SSL=true INIT_DB=true \
    -o none
fi

API_FQDN="$(az containerapp show -n devops-api -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
echo "    API: https://$API_FQDN/api"

echo "==> Building web image in ACR (baking API URL)"
az acr build -r "$ACR_NAME" -t "devops-web:${IMAGE_TAG}" \
  --build-arg "VITE_API_BASE_URL=https://${API_FQDN}/api" \
  "$ROOT/web" -o none

echo "==> Deploying web container app"
if az containerapp show -n devops-web -g "$RG" -o none 2>/dev/null; then
  az containerapp update -n devops-web -g "$RG" \
    --image "${ACR_SERVER}/devops-web:${IMAGE_TAG}" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 3 -o none
else
  az containerapp create \
    -n devops-web -g "$RG" --environment "$ENV_ID" \
    --image "${ACR_SERVER}/devops-web:${IMAGE_TAG}" \
    --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 80 --ingress external \
    --min-replicas "$MIN_REPLICAS" --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    -o none
fi

WEB_FQDN="$(az containerapp show -n devops-web -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

echo "==> Pointing the API's CORS at the web origin"
az containerapp update -n devops-api -g "$RG" \
  --set-env-vars "CORS_ORIGIN=https://${WEB_FQDN}" -o none

# Apps scale to zero, so nothing runs until a request arrives. Send a warm-up
# request now to trigger the API's first-boot schema + seed during deploy.
echo "==> Warming up the API (triggers first-boot schema + seed)"
for i in $(seq 1 20); do
  if curl -fsS --max-time 40 "https://${API_FQDN}/api/health" >/dev/null 2>&1; then
    echo "    API healthy and initialized."; break
  fi
  sleep 6
done

# The API self-seeds on first boot (INIT_DB=true, seeds only when empty), so no
# separate seed step is needed. To force a content reload after editing
# content/*.json, run:
#   az containerapp exec -n devops-api -g "$RG" --command "npm run seed"

cat <<EOF

==================== DONE ====================
 Web UI : https://$WEB_FQDN
 API    : https://$API_FQDN/api
 ACR    : $ACR_NAME
 RG     : $RG   (delete everything: az group delete -n $RG --yes)
 Scale  : min-replicas=$MIN_REPLICAS (0 = scale-to-zero, lowest cost)
 Tip    : stop the DB when idle -> az postgres flexible-server stop -g $RG -n <pg-name>
=============================================
For CI/CD on push, set repo variable ACR_NAME=$ACR_NAME and the AZURE_* secrets
(see deploy/README.md), then the GitHub Actions workflow deploys automatically.
EOF
