# qrrrgh infrastructure

Infrastructure as code for hosting the qrrrgh redirect resolver, and notes on
the existing Static Web App.

| File | Purpose |
| --- | --- |
| `resolver.bicep` | Azure Container Apps environment + resolver app (Consumption, scale to zero). |
| `provision-resolver.ps1` | One-off bootstrap: registers the provider, creates the resource group, deploys `resolver.bicep`. |
| `provision-swa.ps1` | Existing bootstrap for the Azure Static Web App (`qrrrgh-web`). |

The GitHub workflow `.github/workflows/deploy-resolver.yml` builds the image,
pushes it to GitHub Container Registry, and deploys it on every push to `main`
that touches `services/resolver/**` or `infra/**` - but only once you opt in by
setting the `AZURE_ACA_ENABLED` repository variable to `true`.

---

## The point of this design: zero cost at idle

qrrrgh is promised to users as free. The web app already runs on Azure Static
Web Apps Free tier at 0 NOK. The redirect resolver must not change that. The
hard requirement, verbatim:

> "use ACA on Azure for hosting, set zero instances in idle time for test period
> - running cost without users should be zero."

This design makes idle cost **genuinely zero**, not "nearly zero". Below is the
line-by-line defence.

### What is provisioned, and what it bills at idle

| Resource | Billed while idle (no traffic)? | Why |
| --- | --- | --- |
| Container Apps **environment** (Consumption plan) | **No** | The Consumption plan is serverless: "paying only for resources that your apps use." There is no per-hour environment/management fee, unlike a Dedicated/workload-profile plan. |
| Container **app** (`minReplicas: 0`) | **No** | With zero traffic the app scales to zero replicas. Per Microsoft: "When a revision is scaled to zero replicas, no resource consumption charges are incurred." No replicas = no vCPU-seconds, no GiB-seconds. No requests = no request charges. |
| Log Analytics workspace | **Not provisioned** | The environment omits `appLogsConfiguration` (equivalent to `--logs-destination none`), so there is no workspace and nothing ingests logs or bills per GB. |
| Azure Container Registry | **Not provisioned** | Deliberately avoided. ACR Basic is a fixed ~USD 0.167/day (~USD 5/month) charge billed regardless of pulls - that alone would break the requirement. Images live in GitHub Container Registry (ghcr.io), free for this private repo. |
| Public HTTPS ingress / FQDN | **No** | The ingress endpoint carries no standing charge on Consumption; you pay only for requests and the compute they trigger, both zero at idle. |
| Outbound bandwidth | **No** | Idle means no traffic, so no egress. Inbound is always free; the first 100 GB/month of outbound is free (see below). |

**Definitive answer: with no users, this resolver bills nothing.** The only
resources that exist are the Container Apps environment and the app, and both
are on the Consumption plan where an idle, scaled-to-zero app has no meter
running. There is no registry, no Log Analytics workspace, and no
always-on/Dedicated infrastructure anywhere in the template.

### The registry decision: ghcr.io, not ACR

Azure Container Registry Basic costs a **fixed ~USD 5/month per registry, billed
whether or not any image is pulled**. Provisioning it would put the project at
~USD 5/month at idle - a direct violation of the zero-cost promise.

GitHub Container Registry (`ghcr.io`) is free for this repository. Azure
Container Apps supports pulling from non-ACR registries; for a private image you
supply registry credentials, which the template stores as a **secret reference**
(`passwordSecretRef`) - never as a literal in the template. The credential is a
GitHub Personal Access Token (classic) with the `read:packages` scope (or a
fine-grained token with Packages: read).

Trade-off, stated honestly: Microsoft's cold-start guidance recommends a
registry *close to* the environment (a same-region ACR, or a Premium registry
with global distribution) to speed image pulls. ghcr.io is outside Azure, so the
image is pulled over the internet on a cold start. For this small Node image the
extra pull time is a few seconds at most, and it only affects the *first*
request after idle. Paying ~USD 5/month every month to shave a few seconds off
an occasional cold start is the wrong trade for a free product, so ghcr.io wins.

### The logs decision: none

The Container Apps environment is created with **no logs destination**. An idle
app therefore ingests nothing and cannot accrue a Log Analytics bill. The
console log stream (`az containerapp logs show`) is still available on demand for
live debugging. If you later want persistent logs, prefer Azure Monitor with a
tightly scoped diagnostic setting, or a Log Analytics workspace with a daily cap,
and re-check the idle-cost math - see "What would break zero cost" below.

---

## What a request actually costs once traffic starts

Billing on the Consumption plan has two meters plus the free monthly grant
(per subscription):

| Meter | Approx. rate (USD, list) | Free grant per month |
| --- | --- | --- |
| vCPU-seconds (active) | ~$0.000024 / vCPU-second | first **180,000** vCPU-seconds |
| GiB-seconds | ~$0.000003 / GiB-second | first **360,000** GiB-seconds |
| HTTP requests | ~$0.40 / million | first **2,000,000** requests |

Rates are list prices and vary by region/currency; always confirm on the
[Container Apps pricing page](https://azure.microsoft.com/pricing/details/container-apps/).
Free usage does not appear on your bill; you are charged only above the grants.

**This app runs at 0.25 vCPU / 0.5 GiB**, so one running replica consumes 0.25
vCPU-seconds and 0.5 GiB-seconds per second of runtime. Turning the free grant
into runtime:

- 180,000 vCPU-seconds / 0.25 = **720,000 replica-seconds = 200 replica-hours**
  of vCPU headroom per month, free.
- 360,000 GiB-seconds / 0.5 = **720,000 replica-seconds = 200 replica-hours** of
  memory headroom per month, free.

So the free grant alone covers roughly **200 hours (~8 days) of continuous
single-replica runtime every month at no charge** - and the app only runs while
it is actually handling requests, scaling back to zero in between. A test
period with light, bursty traffic stays comfortably inside the free grant, and
well under 2,000,000 requests. In practice the test period cost is **0**, and
the idle cost is **exactly 0** because no meter runs when there are no replicas.

Bandwidth: inbound is free; the first **100 GB/month** of outbound internet data
transfer is free
([bandwidth pricing](https://azure.microsoft.com/pricing/details/bandwidth/)).
Redirect expansion produces small JSON responses and lightweight outbound
HEAD/GET probes, so egress is negligible and zero at idle.

---

## The cold-start trade-off

`minReplicas: 0` is the whole point, and it has one cost that is **not** money:
latency on the first request after the app has been idle. When the app is scaled
to zero, the next request triggers a **cold start** - "the time-consuming
process of pulling your container image, provisioning resources, and starting
your application code"
([cold start docs](https://learn.microsoft.com/azure/container-apps/cold-start)).

For this small image expect **a few seconds** on a cold first request (roughly
2-10s, occasionally more when the image is pulled fresh from ghcr.io); warm
requests respond normally. Microsoft does not publish a guaranteed cold-start
figure. Mitigations already applied here: a small image (multi-stage,
non-root), 0.25 vCPU/0.5 GiB, and a Startup probe that allows up to ~30s for the
process to come up so a slow boot is not killed. The web app should show a
"checking..." state and, if needed, retry once on the first call.

Raising `minReplicas` to 1 would remove the cold start but would keep one
replica always running and **bill continuously** (at the reduced *idle* rate,
~$0.000003/vCPU-second plus memory, roughly a few USD/month) - which breaks the
zero-idle-cost requirement. Cold start is the deliberate, accepted trade.

---

## How to verify zero spend yourself

A "it's free" claim you cannot check is worthless. Verify it directly, easiest
first.

**1. Prove no billed-at-idle resource even exists.** The strongest check is that
the resource group contains only the Container Apps environment and the app -
no Azure Container Registry, no Log Analytics workspace:

```powershell
az resource list --resource-group rg-qrrrgh `
  --query "[].{name:name, type:type}" -o table
```

Expected: `qrrrgh-web` (the Static Web App, Free tier),
`qrrrgh-resolver-env` (Microsoft.App/managedEnvironments), and
`qrrrgh-resolver` (Microsoft.App/containerApps). If you ever see a
`Microsoft.ContainerRegistry/registries` or `Microsoft.OperationalInsights/workspaces`
here, something has been added that can bill at idle.

**2. Azure portal - actual cost.** Open the `rg-qrrrgh` resource group ->
**Cost Management** -> **Cost analysis** -> set the period to the current month
and group by **Resource**. An idle month shows nothing for the Container Apps
resources. See
[Start analyzing costs](https://learn.microsoft.com/azure/cost-management-billing/costs/quick-acm-cost-analysis).
Both resources are tagged `project=qrrrgh` and `component=redirect-resolver`, so
you can also group or filter by the `project` or `component` tag.

**3. Set a safety net.** Create a **Budget** with an alert at a low threshold
(for example USD 1) on `rg-qrrrgh` so any unexpected charge emails you
immediately.

**4. (Optional) Cost figure from the CLI.** The `az costmanagement query`
command needs the Cost Management extension
(`az extension add --name costmanagement`) and works on most, but not all,
subscription types:

```powershell
az costmanagement query `
  --type ActualCost `
  --timeframe MonthToDate `
  --scope "/subscriptions/<SUB_ID>/resourceGroups/rg-qrrrgh"
```

An idle month returns zero rows (or zero cost) for the Container Apps resources.

---

## What would break the zero-cost property later

Keep these in mind; each one turns "free at idle" into "billed at idle":

- **Raising `minReplicas` above 0.** An always-on replica bills continuously.
  This is the single most important line in `resolver.bicep`; it is capped to 0
  by a parameter constraint on purpose.
- **Adding an Azure Container Registry.** ACR Basic is ~USD 5/month flat. Stay on
  ghcr.io.
- **Adding a Log Analytics workspace and letting the app log at volume.** Ingestion
  bills per GB. This template ships with logs destination `none`.
- **Switching the environment to a Dedicated / workload-profile plan.** Dedicated
  profiles bill for provisioned instances even when apps are idle.
- **Enabling always-on features** such as dedicated/minimum instances, VNet
  integration with managed resources, private endpoints, or zone redundancy that
  provisions standing infrastructure.
- **Sustained real traffic** beyond the monthly free grants (180,000
  vCPU-seconds, 360,000 GiB-seconds, 2,000,000 requests) or beyond 100 GB/month
  outbound. This is success, not a mistake, but it is no longer zero - the
  `maxReplicas: 3` cap keeps any spike or abuse bounded.

---

## Deploying (manual steps for the user)

Nothing here deploys automatically or creates billed resources on its own. You
opt in explicitly.

### Prerequisites

- Azure CLI signed in (`az login`) to the target subscription.
- The `services/resolver/` service exists with its `Dockerfile` (built by the
  resolver service work).
- A way for the Container App to pull the image on cold start. This project uses
  a **private `ghcr.io` package plus a classic PAT with `read:packages`** stored
  as the `GHCR_PULL_TOKEN` secret. A public package (no credential) also works.
  See step 3 below for the trade-off and the expiry risk.

### Option A - GitHub Actions (recommended, continuous deployment)

**Steps 1 and 2 are already done.** The OIDC identity exists and the three Azure
secrets are set, so only step 3 remains.

1. ~~**Create an Azure AD app + federated credential for OIDC**~~ - **done.**
   App `qrrrgh-github-deploy` (client id `bbf5937e-3daf-49f3-a3ce-c64d5706a07f`)
   has a service principal and federated credentials for this repository on
   `main`, issuer `https://token.actions.githubusercontent.com`, audience
   `api://AzureADTokenExchange`. It holds **Contributor scoped to `rg-qrrrgh`
   only** - not subscription-wide. See
   [Connect from Azure with OpenID Connect](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect).
   There is no client secret to rotate or leak; the workflow exchanges a
   short-lived GitHub OIDC token at run time.

   > **Trap worth knowing.** GitHub presented the subject
   > `repo:webmaxru@1560278/qrrrgh@1312680270:ref:refs/heads/main` - with
   > **numeric owner and repository ids**, not the documented
   > `repo:OWNER/NAME:ref:refs/heads/main` form. A credential registered with
   > only the documented form fails with `AADSTS700213: No matching federated
   > identity record found for presented assertion subject`. Both subjects are
   > registered here (`github-main` and `github-main-immutable`), so either
   > format works. If you ever see AADSTS700213, read the exact subject out of
   > the error and register that verbatim rather than assuming the docs' shape.
2. ~~**Set repository secrets**~~ - **done for the OIDC trio.**
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` are set.
   These are identifiers rather than credentials; they are stored as secrets by
   convention, and alone they grant nothing without the federated trust above.
3. **Chosen: private package + a `read:packages` PAT.**
   The image lands in `ghcr.io`, and a Container App needs to pull it on every
   cold start - after the ephemeral `GITHUB_TOKEN` from the build job is long
   gone. Two options existed:

   - **Public package (no standing credential).** Set the package's visibility to
     public in GitHub (**Package settings -> Change visibility**); a public image
     needs no pull credential at all. GitHub has **no REST or GraphQL endpoint
     for this** - the Packages API covers metadata, delete and restore only - so
     it is a manual UI action and cannot be scripted.
   - **Private package (selected).** Create a classic PAT with **`read:packages`
     only** and set it as the `GHCR_PULL_TOKEN` secret. `resolver.bicep` stores
     it as a Container App secret and references it by name, never as a literal.

   **The pull credential is a liveness dependency, not just a deploy input.**
   Because `minReplicas` is 0, the app is re-pulled whenever it scales up from
   zero - not only when it is deployed. If the PAT expires or is revoked, the
   resolver stops coming back up, silently, potentially months after the last
   green workflow run. Mitigations in place:

   - Create the PAT with **no expiration** (or diary its rotation), and grant it
     `read:packages` and nothing else.
   - The workflow **verifies the credential can actually pull the just-pushed
     image** (`Verify the image is pullable with the stored credential`) before
     it deploys, so an expired token fails fast with a named cause.
   - The registry username is `github.repository_owner`, **not** `github.actor`:
     the PAT belongs to the owner, so a run triggered by anyone else (Dependabot,
     a collaborator) must not store their login against the owner's token.

   Either way the workflow polls `/healthz` after deploying and **fails loudly**
   if the app never serves, so a pull failure cannot pass as a green deploy.

   Then set repository variable `AZURE_ACA_ENABLED` to `true` (mirrors how
   `deploy-web.yml` is gated on `AZURE_SWA_ENABLED`). Optionally set
   `AZURE_RESOURCE_GROUP` to override the default `rg-qrrrgh`.

   Leaving `AZURE_ACA_ENABLED` unset is deliberate and safe: the resolver
   revision cannot start until the image can be pulled, so nothing runs and
   nothing bills.

   **How to confirm visibility without any token.** GHCR issues an anonymous
   pull token for public packages only, so this distinguishes the two states
   from any machine:

   ```bash
   t=$(curl -s "https://ghcr.io/token?service=ghcr.io&scope=repository:webmaxru/qrrrgh/resolver:pull" | jq -r .token)
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $t" \
     -H 'Accept: application/vnd.oci.image.index.v1+json' \
     https://ghcr.io/v2/webmaxru/qrrrgh/resolver/manifests/<sha>
   # 200 => public, 401 => private
   ```

   **History (26 July 2026).** A `workflow_dispatch` run built and pushed the
   image, logged in to Azure over OIDC, and deployed `resolver.bicep`, creating
   the managed environment and the Container App. The app went to `Failed` state
   for exactly one reason, named by the deployment error:

   ```
   Field 'template.containers.resolver.image' is invalid ... ghcr.io: UNAUTHORIZED: authentication required
   ```

   The package was private and no pull credential had been supplied - which is
   precisely what the `/healthz` gate exists to expose. Supplying
   `GHCR_PULL_TOKEN` and re-running is the fix.

   This confirms the cost design against reality rather than only on paper:
   `rg-qrrrgh` contains the static site, the managed environment and the
   container app, **and no Log Analytics workspace and no container registry**.
   The app reports `minReplicas: 0`, `maxReplicas: 3`, matching the template.
   With zero replicas running there is no compute charge.
4. Push a change under `services/resolver/**` or `infra/**`, or run the **Deploy
   Resolver** workflow via **workflow_dispatch**. It builds the image, pushes it
   to `ghcr.io/<owner>/qrrrgh/resolver:<sha>`, and runs
   `az deployment group create` against `resolver.bicep`.

`provision-resolver.ps1` prints the exact `gh secret set` / `gh variable set`
commands, which is useful if you ever need to recreate the identity from
scratch or point the deployment at a different subscription.

### Option B - one-off from this machine

```powershell
# Registers Microsoft.App, creates rg-qrrrgh if needed, and deploys resolver.bicep.
# Prompts securely for the ghcr.io read:packages token.
# Preview first:
./infra/provision-resolver.ps1 -WhatIf
# Then run for real (push the image to ghcr.io first, or use Option A):
./infra/provision-resolver.ps1
```

The container image must already exist in ghcr.io for the first revision to
become healthy; if it does not, use Option A (which builds and pushes before
deploying).

### Validate the Bicep without deploying

```powershell
az bicep build --file infra/resolver.bicep --outfile infra/resolver.compiled.json
# inspect, then delete the generated file - build output is not committed:
Remove-Item infra/resolver.compiled.json
```

---

## Sources

- [Billing in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/billing) - Consumption meters, "no resource consumption charges" at zero replicas, free grants.
- [Log storage and monitoring options](https://learn.microsoft.com/azure/container-apps/log-options#configure-logging-options) - `--logs-destination` accepts `none`.
- [Deploy to Azure Container Apps with GitHub Actions](https://learn.microsoft.com/azure/container-apps/github-actions#deploy-images-from-non-acr-registries) - pulling private images from ghcr.io with credentials.
- [Reducing cold-start time](https://learn.microsoft.com/azure/container-apps/cold-start) - what a cold start is and how to mitigate it.
- [Set scaling rules](https://learn.microsoft.com/azure/container-apps/scale-app) - HTTP concurrency scaling and replica limits.
- [Container Apps pricing](https://azure.microsoft.com/pricing/details/container-apps/) and [Container Registry pricing](https://azure.microsoft.com/pricing/details/container-registry/) and [Bandwidth pricing](https://azure.microsoft.com/pricing/details/bandwidth/) - list rates and free allowances.
- [Connect from Azure with OpenID Connect](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect) - OIDC federated credentials for GitHub Actions.
- [Start analyzing costs](https://learn.microsoft.com/azure/cost-management-billing/costs/quick-acm-cost-analysis) - verifying spend in the portal.
