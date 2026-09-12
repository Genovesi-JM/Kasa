# Kasa Azure pilot: synthetic, read-only catalogue

Prepared 2026-09-12. These files do not themselves prove a cloud deployment,
production migration or public release. The approved pilot budget is **€100–250
per month for GeoVision, Kaya and Kasa together**, not an allocation to this app.
The release owner performs all Azure actions, image uploads and public-access
decisions. No credentials are required in these files.

The existing resource group is `rg-kasa-pilot-weu`. Its metadata location does
not force the resources into that region. A GeoVision what-if in the same Azure
offer reported that **West Europe was not accepting new customers**; therefore
pass an explicitly confirmed eligible EU `--location` at every stage. Do not
treat any default as proof of eligibility. Spain Central passed this subscription's
foundation preview on 12 September 2026 and is the new default. Scoped resource
names deliberately omit region suffixes. Once deployed, keep the same region;
moving existing resources is a separate reviewed migration, not a parameter edit.

## Exact resource and permission boundary

Foundation (`runtime=false`) provisions five resources:

| Resource | Name | Pilot configuration |
| --- | --- | --- |
| Container Registry | `acrkaspilot<uniqueString(resourceGroup().id)>` | Basic; admin login and anonymous pull disabled |
| User-assigned managed identity | `id-kasa-pilot` | Dedicated to this app, not shared with other projects |
| Role assignment | Deterministic GUID | **AcrPull on this registry only** |
| Log Analytics workspace | `log-kasa-pilot` | PerGB2018, 30-day retention, 0.1 GB/day ingestion cap |
| Container Apps environment | `cae-kasa-pilot` | Consumption workload profile only; no dedicated profile or VNet |

Runtime (`runtime=true`) adds one resource: `ca-kasa-pilot`, using
`<own-registry>/kasa-web-api@sha256:<reviewed-manifest-digest>`. It has 0–2 replicas,
0.25 vCPU / 0.5 GiB each, one HTTP scaling rule (20 concurrent requests), no
workers, no volume and no application secret bindings. Port is **8787**. Its
only Azure role is the registry-scoped AcrPull role
`7f951dda-4ed3-4680-a7ca-43fe172d538d`; it cannot push images or access other
projects through any role provisioned here.

Required provider registrations: `Microsoft.App`, `Microsoft.ContainerRegistry`,
`Microsoft.ManagedIdentity`, `Microsoft.Authorization`,
`Microsoft.OperationalInsights`. The deployment operator needs resource-creation
rights in this group and role-assignment write rights at this registry scope.
Registration may require subscription-level permission. The operator's existing
rights are not granted to the runtime identity. Image publishing is a separate
operator action, never an AcrPush grant to the runtime identity.

“Private registry” here means authenticated, non-anonymous images. **ACR Basic
uses a public network endpoint; no Premium private endpoint is provisioned.**
The environment has no dedicated private network. With `externalIngress=false`,
the app is reachable only from its Container Apps environment; this is not a
claim of a private-endpoint architecture. When explicitly enabled, ACA's managed
hostname serves HTTPS and `allowInsecure=false`. No custom-domain/DNS change is
included. [Microsoft's registry schema](https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/2025-04-01/registries)
documents the registry settings.

Excluded: PostgreSQL, Redis, Blob storage, Key Vault, App Configuration,
Service Bus, Application Insights, paid/dedicated workers, new API providers,
custom certificates and external monitoring. The current application does not
consume these; creating empty services would not implement missing features.
ACR still has a standing cost. Requests, running replicas, logs and egress remain
usage-dependent. Scale-to-zero and log ingestion caps are **not** a total spending
cap or a zero-cost promise; ingestion can overshoot a daily cap and logs may stop
when it is reached. Reconcile this app with the aggregate project budget.

## Offline checks

Run from the Kasa `app` directory:

```sh
BICEP_BIN=/Users/genovesimaria/.azure/bin/bicep bash infra/azure/validate.sh
```

The suite compiles Bicep to memory and checks resource count, own-registry-only
identity scope, default private ingress, scale, log limits, immutable-image
syntax, probe paths and rejection of unsafe/placeholder parameters. It does not
log in, provision resources, inspect environment files, start containers, or
contact a database. The container's separate verification is documented in
[`docs/AZURE_PILOT_CONTAINER.md`](../../docs/AZURE_PILOT_CONTAINER.md).

## Reviewed two-stage deployment

`parameters.py` is an **offline non-secret parameter generator**, not a deployer.
Use it before every what-if/create. It refuses missing, malformed, mutable-tag
or all-zero runtime image digests and public ingress without runtime. The Bicep
image expression always uses `@<digest>`, never a tag; ARM does not implement
the helper's complete digest validation. Do not bypass the helper with manually
constructed runtime parameters.

1. Confirm the signed-in subscription and existing resource group. Select an
   Azure-supported EU region eligible for the current offer. Validate the
   template above and check current regional pricing/quotas. The release owner
   then reviews the five-resource **foundation what-if** before creating it.

   Example commands below perform cloud mutations only when the release owner
   runs `create`. Replace the region placeholder first; no account switch or
   provider registration is hidden in this runbook.

   ```sh
   KASA_AZURE_REGION='REPLACE_WITH_CONFIRMED_REGION'
   KASA_AZURE_PARAMS_DIR="$(mktemp -d)"
   python3 infra/azure/parameters.py --location "$KASA_AZURE_REGION" > "$KASA_AZURE_PARAMS_DIR/foundation.json"
   az deployment group what-if --resource-group rg-kasa-pilot-weu --template-file infra/azure/main.bicep --parameters "@$KASA_AZURE_PARAMS_DIR/foundation.json"
   az deployment group create --name kasa-pilot-foundation --resource-group rg-kasa-pilot-weu --template-file infra/azure/main.bicep --parameters "@$KASA_AZURE_PARAMS_DIR/foundation.json"
   ```

2. Read the successful foundation outputs `registryName`, `registryLoginServer`
   and `identityResourceId`. Have the approved operator publish the reviewed
   **linux/amd64** `kasa-web-api:pilot` image to the `kasa-web-api` repository in
   that registry. No source upload or credentials are provided by this template.
   Verify the uploaded manifest digest against the tested release. A local Docker
   image ID is not necessarily the registry manifest digest. Keep the exact
   digest as the release record, not only the mutable upload tag.

3. Generate runtime parameters with **external ingress still false** and review
   the what-if before create. Allow for managed-identity role propagation; do
   not enable the registry administrator or add broader roles to solve a
   transient pull failure.

   ```sh
   KASA_IMAGE_DIGEST='REPLACE_WITH_REVIEWED_SHA256_DIGEST'
   python3 infra/azure/parameters.py --location "$KASA_AZURE_REGION" --runtime --image-digest "$KASA_IMAGE_DIGEST" > "$KASA_AZURE_PARAMS_DIR/runtime-internal.json"
   az deployment group what-if --resource-group rg-kasa-pilot-weu --template-file infra/azure/main.bicep --parameters "@$KASA_AZURE_PARAMS_DIR/runtime-internal.json"
   az deployment group create --name kasa-pilot-runtime --resource-group rg-kasa-pilot-weu --template-file infra/azure/main.bicep --parameters "@$KASA_AZURE_PARAMS_DIR/runtime-internal.json"
   ```

4. Check the deployed image digest, replica configuration and Azure revision
   health. Internal ingress is intentionally not reachable from an ordinary
   public browser. The operator can inspect revision/container logs and use an
   approved Container Apps exec session to fetch localhost health/readiness.
   No extra test service needs to be created. Check the API/web from the same
   container as described in the packaging guide. Full browser QA on Azure's
   managed public hostname remains a separate post-enablement check.

5. **Only after explicit release-owner approval of public synthetic-demo access**,
   regenerate parameters with `--runtime --external-ingress`, the same region
   and exact reviewed image digest. Review another what-if, then deploy it.
   The output `publicOrigin` is empty unless public ingress is enabled. Runtime
   CORS permits only the app's computed HTTPS managed hostname, with no wildcard
   and no local-development origins. It uses this future public origin during
   the internal stage too; health probes require no Origin/auth header. Custom
   domains or cross-origin sites require an explicitly reviewed CORS change.

Do not use `runtime=false` as a shutdown operation: incremental ARM deployment
does not delete an existing application when a conditional resource is omitted.
To close public access, redeploy the existing reviewed runtime with
`externalIngress=false`; verify the actual ingress afterwards. This does not
erase the registry, workspace or environment and does not eliminate their costs.
Do not delete/recreate the identity casually: this template's deterministic role
assignment is tied to its resource ID; replacing its principal requires reviewed
cleanup/reconciliation of the old assignment, not broad extra permissions.

## Honesty and release checks

- Startup/liveness: `GET /api/v1/health`, no authentication or Origin required.
- Readiness: `GET /api/v1/ready`, verifying synthetic API and bundled web output.
  Expected response includes `mode: read_only_demo`, `data: synthetic`,
  `persistence: not_configured`, **`productionReady: false`**. Healthy infrastructure
  does not mean production-ready business flows.
- `NODE_ENV=production`, `KASA_API_DEMO_WRITES=false`, `KASA_API_COUNTRY=demo`,
  `KASA_API_SERVE_WEB=true`; never provide `KASA_API_DEMO_KEY`. Runtime does not
  load a private environment file. Browser `VITE_` variables are not secret stores.
- Verify homepage/assets, catalogue rendering, no misleading SPA fallback for
  unknown API paths, rejection of both write routes, correct demo messaging,
  mobile viewport layout, cold starts, and bounded replica behaviour after
  deployment. API rate limiting is per-process, not a global budget/abuse limit.
- Do not enter real customer, identity, financial or tenancy records. Auth,
  authorisation, transactional persistence, private documents, payments,
  messaging, verification, backups/restore and retention are still production
  work, not features supplied by Azure hosting.
- External photographs/map services and the existing moderate `qs` advisories
  remain review items in the packaging guide. A catalogue rendering is not proof
  of provider licensing, production listings or complete data migration.

## Validation record

On 2026-09-12, Bicep **0.47.16** compiled this template without warnings and
**14 offline tests passed**. The shell syntax check also passed. These are the
evidence provided by this change. Actual Azure region acceptance, deployment, image pull, runtime health,
public TLS/browser QA and spend are **not verified by this infra-only task**.
