// =========================================================================
// DevOps Practice Platform — Azure infrastructure (Container Apps stack)
//
// Provisions the foundational, rarely-changing infrastructure:
//   - Azure Container Registry (stores the api & web images)
//   - Azure Database for PostgreSQL Flexible Server (+ database, + firewall)
//   - Log Analytics workspace + Azure Container Apps managed environment
//
// The two container apps themselves are created by deploy/deploy.sh after the
// images are built, because the web image bakes in the API's URL at build time
// (an inherently sequential step). See deploy/README.md.
// =========================================================================

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Short lowercase prefix for resource names (letters/numbers only).')
@minLength(3)
@maxLength(12)
param namePrefix string = 'devops'

@description('PostgreSQL administrator username.')
param pgAdmin string = 'devopsadmin'

@description('PostgreSQL administrator password.')
@secure()
param pgPassword string

@description('Application database name.')
param databaseName string = 'devops_platform'

var suffix = uniqueString(resourceGroup().id)
var acrName = toLower('${namePrefix}acr${suffix}')
var pgName = toLower('${namePrefix}-pg-${suffix}')
var envName = '${namePrefix}-aca-env'
var lawName = '${namePrefix}-logs'

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: pgAdmin
    administratorLoginPassword: pgPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

// Allow other Azure services (the Container Apps) to reach the DB.
// The special 0.0.0.0 range means "Azure services", not the public internet.
resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output environmentId string = env.id
output environmentName string = env.name
output pgFqdn string = pg.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output pgAdmin string = pgAdmin
