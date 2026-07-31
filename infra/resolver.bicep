// QRavn redirect resolver - Azure Container Apps (Consumption, scale to zero)
//
// Product requirement (verbatim): "use ACA on Azure for hosting, set zero
// instances in idle time for test period - running cost without users should
// be zero." This template is built to make idle cost GENUINELY zero, not
// "nearly zero". Every resource below was chosen so that an idle app with no
// traffic bills nothing:
//
//   * Container Apps Consumption plan. Serverless, scale to zero. Compute is
//     billed per vCPU-second and GiB-second ONLY while replicas run, plus per
//     HTTP request. Per Microsoft's billing docs: "When a revision is scaled to
//     zero replicas, no resource consumption charges are incurred."
//     https://learn.microsoft.com/azure/container-apps/billing
//   * NO Log Analytics workspace. The environment omits appLogsConfiguration,
//     which is equivalent to "--logs-destination none". An idle app therefore
//     ingests no platform logs and accrues no log bill.
//     https://learn.microsoft.com/azure/container-apps/log-options
//   * NO Azure Container Registry. ACR Basic is a fixed ~USD 0.167/day (~USD
//     5/month) charge billed whether or not an image is pulled, which would
//     break the zero-idle requirement. Images are pulled from GitHub Container
//     Registry (ghcr.io), free for a private repository, using stored
//     credentials referenced as a secret.
//     https://learn.microsoft.com/azure/container-apps/github-actions
//   * Consumption-only environment (no workloadProfiles array). A Dedicated /
//     workload-profile environment bills for the provisioned profile even when
//     idle and is deliberately NOT used here.
//
// See infra/README.md for the full cost breakdown and how to verify zero spend.

targetScope = 'resourceGroup'

@description('Location for all resources. Matches the existing Static Web App region.')
param location string = 'westeurope'

@description('Name of the Container Apps environment (Consumption-only, serverless).')
param environmentName string = 'qravn-resolver-env'

@description('Name of the resolver container app.')
param containerAppName string = 'qravn-resolver'

@description('Fully qualified container image. Use an immutable tag such as the Git SHA, for example ghcr.io/webmaxru/qravn/resolver:<sha>.')
param containerImage string = 'ghcr.io/webmaxru/qravn/resolver:latest'

@description('Container registry login server. Defaults to GitHub Container Registry.')
param registryServer string = 'ghcr.io'

@description('Registry username for private image pulls. For ghcr.io use a GitHub username or the workflow actor. Leave empty only for a public image.')
param registryUsername string = ''

@secure()
@description('Registry password or token for private image pulls. For ghcr.io use a PAT with the read:packages scope. Never hardcode this; pass it at deploy time. Leave empty only for a public image.')
param registryPassword string = ''

@description('Target port the resolver listens on. The service defaults to 8080.')
param targetPort int = 8080

@description('Minimum replicas. MUST stay 0 so idle cost is zero. Do not raise this.')
@minValue(0)
@maxValue(0)
param minReplicas int = 0

@description('Maximum replicas. A small cap so a traffic spike or an abuse attempt cannot run up a bill.')
@minValue(1)
@maxValue(10)
param maxReplicas int = 3

@description('Concurrent requests per replica that triggers scale-out.')
@minValue(1)
param concurrentRequests int = 20

@description('Optional custom HTTPS hostname for the web frontend, for example qravn.isainative.dev. Empty means no custom web hostname is configured.')
param webCustomHostname string = ''

@description('Optional custom HTTPS hostname for the resolver API, for example qravn-api.isainative.dev. Empty means no custom API hostname is configured. Binding is completed by the provisioning script after DNS exists.')
param resolverCustomHostname string = ''

@description('Resource id of the managed certificate for resolverCustomHostname. Empty leaves the custom domain unbound, which is the correct state before the certificate has been issued.')
param resolverCertificateId string = ''

@description('Comma-separated exact CORS origins for the resolver. Empty uses localhost dev origins plus webCustomHostname when provided. Never use a wildcard.')
param resolverCorsAllowedOrigins string = ''

// Only wire up registry authentication when a password/token was supplied. This
// keeps the secret out of the template (it is always passed at deploy time) and
// also allows a public image to be used with no credentials.
var useRegistryAuth = !empty(registryPassword)
var registryPasswordSecretName = 'registry-password'
var devCorsAllowedOrigins = 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173'
var customWebOrigin = empty(webCustomHostname) ? '' : 'https://${webCustomHostname}'
var bindCustomDomain = !empty(resolverCustomHostname) && !empty(resolverCertificateId)
var effectiveCorsAllowedOrigins = !empty(resolverCorsAllowedOrigins)
  ? resolverCorsAllowedOrigins
  : (empty(customWebOrigin) ? devCorsAllowedOrigins : '${devCorsAllowedOrigins},${customWebOrigin}')

var commonTags = {
  project: 'qravn'
  component: 'redirect-resolver'
}

// Consumption-only Container Apps environment.
// Deliberately omits:
//   * appLogsConfiguration  => logs destination is "none", no Log Analytics, no ingestion cost.
//   * workloadProfiles      => serverless Consumption plan, not a billed Dedicated profile.
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: commonTags
  properties: {
    zoneRedundant: false
  }
}

resource resolver 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: commonTags
  properties: {
    environmentId: environment.id
    configuration: {
      // Single revision mode: each deployment shifts all traffic to the latest
      // revision, which suits a stateless continuous-deployment service.
      activeRevisionsMode: 'Single'
      ingress: {
        // Public HTTPS endpoint the web app calls from the browser. Azure
        // terminates TLS and serves the app on an HTTPS *.azurecontainerapps.io
        // FQDN. allowInsecure:false redirects any plain HTTP to HTTPS.
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        // Declared here so a deployment never strips it. A custom domain bound
        // out of band with `az containerapp hostname bind` disappears on the
        // next template deployment, because the template is the desired state.
        customDomains: bindCustomDomain ? [
          {
            name: resolverCustomHostname
            certificateId: resolverCertificateId
            bindingType: 'SniEnabled'
          }
        ] : null
      }
      secrets: useRegistryAuth ? [
        {
          name: registryPasswordSecretName
          value: registryPassword
        }
      ] : []
      registries: useRegistryAuth ? [
        {
          server: registryServer
          username: registryUsername
          // Reference the secret by name; never a literal credential here.
          passwordSecretRef: registryPasswordSecretName
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'resolver'
          image: containerImage
          // Plain, non-secret runtime configuration. The resolver holds no
          // secrets, so these are safe as literal env values. Setting them here
          // makes the deployed configuration self-documenting. Environment
          // variables add no cost, so this does not affect the zero-idle math.
          env: [
            {
              // Authoritative production switch. In production the service must
              // REFUSE the dangerous dev-only bypasses (DEV_ALLOW_LOOPBACK,
              // DEV_EXTRA_ALLOWED_PORTS, disabling TLS verification), not merely
              // default them off. Belt-and-braces with the Dockerfile.
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              // Container Apps ingress terminates the client connection and sets
              // X-Forwarded-For. The service defaults TRUST_PROXY to false, which
              // behind ingress would make every request appear to come from the
              // ingress address, so the 20-req/10s limiter bucket would be shared
              // by ALL clients worldwide (instant 429s for legitimate users; one
              // abuser denies service to everyone). Enabling it restores correct
              // per-client rate limiting.
              name: 'TRUST_PROXY'
              value: 'true'
            }
            {
              // Pin the listener to the SAME parameter the ingress targets so the
              // two can never drift. The service also defaults to 8080, but this
              // removes any reliance on two independent defaults agreeing. Env
              // values must be strings, hence string().
              name: 'PORT'
              value: string(targetPort)
            }
            {
              // Exact allow-list only. During a domain cutover, pass both the old
              // and new web origins. Do not use '*': browsers would then allow any
              // site to call the public resolver from a visitor's browser.
              name: 'CORS_ALLOWED_ORIGINS'
              value: effectiveCorsAllowedOrigins
            }
          ]
          // Modest sizing. 0.25 vCPU / 0.5 GiB is plenty for a redirect
          // resolver and minimises per-second cost while a replica runs.
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              // Startup probe covers the cold-start window after scale from
              // zero: up to ~30s (10 x 3s) before the replica is considered
              // failed, so a slow first boot is not killed prematurely.
              type: 'Startup'
              httpGet: {
                path: '/healthz'
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 2
              periodSeconds: 3
              timeoutSeconds: 3
              failureThreshold: 10
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: targetPort
                scheme: 'HTTP'
              }
              periodSeconds: 15
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: targetPort
                scheme: 'HTTP'
              }
              periodSeconds: 10
              timeoutSeconds: 3
              successThreshold: 1
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        // ***********************************************************************
        // minReplicas: 0 is THE requirement. With zero replicas and no traffic
        // there is no running compute and no per-request charge, so idle cost
        // is zero. The trade-off is a cold start on the first request after a
        // period of inactivity (image pull + process start; typically a few
        // seconds for this small image). That latency is the deliberate,
        // accepted price of zero idle cost. Do NOT raise minReplicas above 0
        // without accepting an always-on per-second bill.
        // ***********************************************************************
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            // HTTP scale rule: replicas wake on demand and scale out when
            // concurrent requests per replica exceed the threshold, capped by
            // maxReplicas so a spike or abuse cannot run up an unbounded bill.
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: string(concurrentRequests)
              }
            }
          }
        ]
      }
    }
  }
}

@description('The resolver public hostname.')
output resolverFqdn string = resolver.properties.configuration.ingress.fqdn

@description('The resolver HTTPS base URL the web app should call.')
output resolverUrl string = 'https://${resolver.properties.configuration.ingress.fqdn}'

@description('The desired custom resolver HTTPS base URL, or an empty string when resolverCustomHostname is empty.')
output resolverCustomUrl string = empty(resolverCustomHostname) ? '' : 'https://${resolverCustomHostname}'
