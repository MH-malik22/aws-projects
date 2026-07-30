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
  [bool]  $Seed       = $true
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
az containerapp show -n devops-api -g $Rg -o none 2>$null
if ($LASTEXITCODE -eq 0) {
  Invoke-Az containerapp update -n devops-api -g $Rg `
    --image "$acrServer/devops-api:$ImageTag" `
    --set-env-vars DATABASE_SSL=true PORT=4000 -o none
} else {
  Invoke-Az containerapp create `
    -n devops-api -g $Rg --environment $envId `
    --image "$acrServer/devops-api:$ImageTag" `
    --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 4000 --ingress external `
    --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi `
    --secrets "db-url=$dbUrl" `
    --env-vars DATABASE_URL=secretref:db-url PORT=4000 DATABASE_SSL=true `
    --command "/bin/sh" "-c" "npm run migrate && npm start" `
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
  Invoke-Az containerapp update -n devops-web -g $Rg --image "$acrServer/devops-web:$ImageTag" -o none
} else {
  Invoke-Az containerapp create `
    -n devops-web -g $Rg --environment $envId `
    --image "$acrServer/devops-web:$ImageTag" `
    --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 80 --ingress external `
    --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi `
    -o none
}

$webFqdn = az containerapp show -n devops-web -g $Rg --query properties.configuration.ingress.fqdn -o tsv

Write-Host "==> Pointing the API's CORS at the web origin"
Invoke-Az containerapp update -n devops-api -g $Rg --set-env-vars "CORS_ORIGIN=https://$webFqdn" -o none

if ($Seed) {
  Write-Host "==> Seeding the 17 modules (one-time; reloads content)"
  az containerapp exec -n devops-api -g $Rg --command "npm run seed"
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "seed via exec failed/skipped. Run manually: az containerapp exec -n devops-api -g $Rg --command `"npm run seed`""
  }
}

Write-Host ""
Write-Host "==================== DONE ===================="
Write-Host " Web UI : https://$webFqdn"
Write-Host " API    : https://$apiFqdn/api"
Write-Host " ACR    : $acrName"
Write-Host " RG     : $Rg   (delete everything: az group delete -n $Rg --yes)"
Write-Host "=============================================="
