targetScope = 'resourceGroup'

@description('Two-stage pilot: false provisions the foundation only; true adds the reviewed immutable application image.')
param runtime bool = false

@description('Public access stays disabled until the release owner explicitly enables it after QA.')
param externalIngress bool = false

@description('Release owner must confirm an eligible EU region for this subscription before deployment.')
param location string = 'spaincentral'

@description('Image manifest digest, sha256:<64 lowercase hex characters>. Required when runtime=true; validate with parameters.py first.')
param imageDigest string = ''

var suffix = uniqueString(resourceGroup().id)
var registryName = 'acrkaspilot${suffix}'
var applicationName = 'ca-kasa-pilot'
var tags = {
  brand: 'Valle Baobab'
  project: 'Kasa'
  environment: 'pilot'
  dataClassification: 'synthetic-only'
  productionReady: 'false'
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    // Basic uses an authenticated public endpoint, not a private endpoint.
    publicNetworkAccess: 'Enabled'
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-kasa-pilot'
  location: location
  tags: tags
}

var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRoleId)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleId
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-kasa-pilot'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json('0.1')
    }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-kasa-pilot'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

// This is the future public ACA origin, not a wildcard. Internal QA can use
// health probes without Origin. Enabling ingress does not change the web build.
var canonicalOrigin = 'https://${applicationName}.${environment.properties.defaultDomain}'

resource application 'Microsoft.App/containerApps@2024-03-01' = if (runtime) {
  name: applicationName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: externalIngress
        targetPort: 8787
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'kasa-web-api'
          // Always digest-addressed in our own registry; never a mutable tag.
          image: '${registry.properties.loginServer}/kasa-web-api@${imageDigest}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'KASA_API_HOST', value: '0.0.0.0' }
            { name: 'KASA_API_PORT', value: '8787' }
            { name: 'KASA_API_SERVE_WEB', value: 'true' }
            { name: 'KASA_API_DEMO_WRITES', value: 'false' }
            { name: 'KASA_API_COUNTRY', value: 'demo' }
            { name: 'KASA_API_ENV_FILE', value: '/app/no-runtime-env-file' }
            { name: 'KASA_API_ALLOWED_ORIGINS', value: canonicalOrigin }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/api/v1/health', port: 8787, scheme: 'HTTP' }
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 24
            }
            {
              type: 'Liveness'
              httpGet: { path: '/api/v1/health', port: 8787, scheme: 'HTTP' }
              periodSeconds: 30
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/v1/ready', port: 8787, scheme: 'HTTP' }
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'bounded-http'
            http: {
              metadata: { concurrentRequests: '20' }
            }
          }
        ]
      }
    }
  }
  dependsOn: [acrPull]
}

output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output identityResourceId string = identity.id
output identityPrincipalId string = identity.properties.principalId
output logWorkspaceName string = logs.name
output environmentName string = environment.name
output applicationName string = applicationName
output runtimeEnabled bool = runtime
output publicIngressEnabled bool = runtime && externalIngress
output applicationFqdn string = runtime ? application!.properties.configuration.ingress.fqdn : ''
output publicOrigin string = runtime && externalIngress ? canonicalOrigin : ''
