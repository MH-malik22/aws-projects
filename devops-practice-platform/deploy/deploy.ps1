<#
.SYNOPSIS
  One-command deploy of the DevOps Practice Platform to Azure Container Apps.
  Native PowerShell version of deploy.sh (for Windows, no bash needed).

.EXAMPLE
  ./deploy/deploy.ps1 -PgPassword 'Str0ng_Passw0rd!'

.NOTES
  Requires the Azure CLI (`az`) logged in (`az login`). Images are built in the
  cloud with `az acr build`, so no local Docker is needed. If PowerShell blocks
  the script, run it as:
    powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -PgPassword '...'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PgPassword,
  [string]$Location   = 'eastus',
  [string]$Rg         = 'devops-platform-rg',
  [string]$NamePrefix = 'devops',
  [string]$PgAdmin    = 'devopsadmin',
  [string]$ImageTag   = (Get-Date -Format 'yyyyMMddHHmmss'),
  # Cost-optimized by default: apps scale to zero when idle. Pass -MinReplicas 1
  # to keep them always-warm (no cold starts, higher cost).
  [int]   $MinReplicas = 0
)

# Run an `az` command and stop the script if it fails (emulates `set -e`).
function Invoke-Az {
  az @args
  if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# Platform root = the parent of this script's folder (deploy/).
$root       = Split-Path $PSScriptRoot -Parent
$bicep      = Join-Path $root 'deploy/bicep/main.bicep'
$dockerfile = Join-Path $root 'server/Dockerfile'
$webCtx     = Join-Path $root 'web'

function Get-Out($name) {
  az deployment group show -g $Rg -n devops-infra --query "properties.outputs.$name.value" -o tsv
}

Write-Host "==> Resource group: $Rg ($Location)"
Invoke-Az group create -n $Rg -l $Location -o none

Write-Host "==> Deploying infrastructure via Bicep (ACR, PostgreSQL, Container Apps env)"
Invoke-Az deployment group create `
  -g $Rg -n devops-infra `
  --template-file $bicep `
  --parameters location=$Location namePrefix=$NamePrefix pgAdmin=$PgAdmin pgPassword=$PgPassword `
  -o none

$acrName   = Get-Out 'acrName'
$acrServer = Get-Out 'acrLoginServer'
$envId     = Get-Out 'environmentId'
$pgFqdn    = Get-Out 'pgFqdn'
$dbName    = Get-Out 'databaseName'

$dbUrl   = "postgres://${PgAdmin}:${PgPassword}@${pgFqdn}:5432/${dbName}?sslmode=require"
$acrUser = az acr credential show -n $acrName --query username -o tsv
$acrPass = az acr credential show -n $acrName --query 'passwords[0].value' -o tsv

Write-Host "==> Building API image in ACR (devops-api:$ImageTag)"
Invoke-Az acr build -r $acrName -t "devops-api:$ImageTag" -f $dockerfile $root -o none

Write-Host "==> Deploying API container app"
# INIT_DB=true makes the API apply its schema and seed-if-empty on startup, so
# no fragile startup-command override is needed.
az containerapp show -n devops-api -g $Rg -o none 2>$null
if ($LASTEXITCODE -eq 0) {
  Invoke-Az containerapp update -n devops-api -g $Rg `
    --image "$acrServer/devops-api:$ImageTag" `
    --min-replicas $MinReplicas --max-replicas 3 `
    --set-env-vars DATABASE_SSL=true PORT=4000 INIT_DB=true -o none
} else {
  Invoke-Az containerapp create `
    -n devops-api -g $Rg --environment $envId `
    --image "$acrServer/devops-api:$ImageTag" `
    --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 4000 --ingress external `
    --min-replicas $MinReplicas --max-replicas 3 --cpu 0.5 --memory 1.0Gi `
    --secrets "db-url=$dbUrl" `
    --env-vars DATABASE_URL=secretref:db-url PORT=4000 DATABASE_SSL=true INIT_DB=true `
    -o none
}

$apiFqdn = az containerapp show -n devops-api -g $Rg --query properties.configuration.ingress.fqdn -o tsv
Write-Host "    API: https://$apiFqdn/api"

Write-Host "==> Building web image in ACR (baking API URL)"
Invoke-Az acr build -r $acrName -t "devops-web:$ImageTag" `
  --build-arg "VITE_API_BASE_URL=https://$apiFqdn/api" `
  $webCtx -o none

Write-Host "==> Deploying web container app"
az containerapp show -n devops-web -g $Rg -o none 2>$null
if ($LASTEXITCODE -eq 0) {
  Invoke-Az containerapp update -n devops-web -g $Rg `
    --image "$acrServer/devops-web:$ImageTag" `
    --min-replicas $MinReplicas --max-replicas 3 -o none
} else {
  Invoke-Az containerapp create `
    -n devops-web -g $Rg --environment $envId `
    --image "$acrServer/devops-web:$ImageTag" `
    --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 80 --ingress external `
    --min-replicas $MinReplicas --max-replicas 3 --cpu 0.5 --memory 1.0Gi `
    -o none
}

$webFqdn = az containerapp show -n devops-web -g $Rg --query properties.configuration.ingress.fqdn -o tsv

Write-Host "==> Pointing the API's CORS at the web origin"
Invoke-Az containerapp update -n devops-api -g $Rg --set-env-vars "CORS_ORIGIN=https://$webFqdn" -o none

# Apps scale to zero, so nothing runs until a request arrives. Send a warm-up
# request now to trigger the API's first-boot schema + seed during deploy (so
# the first real visit is fast). Allows a generous timeout for the cold start.
Write-Host "==> Warming up the API (triggers first-boot schema + seed)"
$ok = $false
for ($i = 1; $i -le 20; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://$apiFqdn/api/health" -TimeoutSec 40
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep -Seconds 6 }
}
if ($ok) { Write-Host "    API healthy and initialized." }
else { Write-Warning "API not confirmed healthy yet — it will initialize on first visit (may be slow once)." }

# The API self-seeds on first boot (INIT_DB=true, seeds only when empty), so no
# separate seed step is needed. To force a content reload after changing
# content/*.json, run:  az containerapp exec -n devops-api -g $Rg --command "npm run seed"

Write-Host ""
Write-Host "==================== DONE ===================="
Write-Host " Web UI : https://$webFqdn"
Write-Host " API    : https://$apiFqdn/api"
Write-Host " ACR    : $acrName"
Write-Host " RG     : $Rg   (delete everything: az group delete -n $Rg --yes)"
Write-Host " Scale  : min-replicas=$MinReplicas (0 = scale-to-zero, lowest cost)"
Write-Host " Tip    : stop the DB when idle -> az postgres flexible-server stop -g $Rg -n <pg-name>"
Write-Host "=============================================="
