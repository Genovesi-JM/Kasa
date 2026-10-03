# Kasa read-only demo container

This packages the existing Kasa web experience and catalogue API for a limited
Azure pilot. It does **not** implement production identity, PostgreSQL persistence,
private uploads, payments, verification, remote messaging or notification delivery. Use only
synthetic examples; do not enter real customer, tenant, identity or financial data.
Interactive browser flows remain demonstrations. The two API write routes are
disabled, and `NODE_ENV=production` refuses to start if demo writes are enabled.

See [FUNCTION_STATUS.md](./FUNCTION_STATUS.md) and [API_AND_DATA.md](./API_AND_DATA.md)
for the unchanged product and production boundaries. Hosting does not establish
regulatory readiness or make the illustrative Barcelona catalogue real listings.

## One image, one origin

- Suggested local image name: `kasa-web-api:pilot`.
- Target platform for Azure Container Apps: `linux/amd64`.
- Container port: **8787**, HTTP behind Azure's HTTPS ingress.
- Start command: `node build-api/server/index.js`.
- The image serves the compiled React app at `/` and Express API at `/api/v1`.
- The web build uses `/api/v1/` on the current origin. No URL rebuild is needed
  when Azure assigns a hostname or a custom domain is added.
- TypeScript is compiled before release; the runtime does not need `tsx`, Vite,
  TypeScript or other development dependencies.
- The runtime installation omits development and optional dependencies. This
  excludes TypeScript even when a translation library declares it as an optional
  peer; the build and verification stages retain their complete tooling.
- The official Node 24 base is pinned by digest. `npm ci` uses the existing
  lockfile. Review and update the base digest regularly.
- The final process runs as the unprivileged `node` user. The build-context
  allowlist excludes local environments, keys, databases, uploads and Git data.
  No real provider credential is required or baked into this demo image.
  Source inputs are limited to TypeScript and CSS in `src`, the server TypeScript
  and configuration, and TypeScript verification scripts. Nested dependencies,
  generated output, local work files and secrets remain excluded. New asset or
  configuration formats require an explicit allowlist review.

## Local verification

Run from the Kasa `app` directory:

```sh
npm run check
docker build --platform linux/amd64 --target verification .
docker build --platform linux/amd64 -t kasa-web-api:pilot .
docker run --name kasa-pilot-check --rm --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8787:8787 \
  -e KASA_API_ALLOWED_ORIGINS=http://127.0.0.1:8787 \
  kasa-web-api:pilot
```

Open `http://127.0.0.1:8787` and verify both `/api/v1/health` and
`/api/v1/ready`. Stop only this test container with `docker stop kasa-pilot-check`.
Use a distinct local port/name if another service already occupies these values.

The final Docker image depends on the `verification` target, which executes
`npm run check` using the same locked Linux dependencies without host dependency
folders. The verification stage includes the state/localization checks and Pages
helpers, with Git installed there for the disposable repository fixtures. Git,
source files and test scripts are not copied into the runtime stage. You can run
verification on its own as shown above. A successful local build is not proof of
a deployed Azure service.

Run the independent lightweight context regression when changing build inputs:

```sh
python3 server/docker-context-smoke.py
```

It exercises Docker's actual ignore rules with a disposable `FROM scratch`
fixture containing invented nested database, log, credential, environment, JSON
and generated-output files. Its expected input inventory follows the actual
source, locale, server and verification-script filenames independently of the
ignore rules. It copies only `.dockerignore` from the repository and creates
synthetic contents; it does not read real private files. It does not build or modify the Kasa
application image, install dependencies, access external providers or upload
anything. Its fixture and exported files are removed automatically afterward.

## Azure handoff (no deployment performed here)

Use an approved Container Apps Consumption environment and the reviewed image
digest from the chosen registry. ACR is not required if a suitable GHCR/private
registry is already configured. Do not make a private image public to avoid
registry credentials. Do not reuse another project's application credentials.

For the approved low-traffic synthetic pilot, use zero replicas minimum and two
maximum, **0.25 vCPU / 0.5 GiB**, then validate cold starts and memory before
changing these limits. No background IoT or durable task delivery is promised.
Keep external ingress off during initial deployment. After the staging access
and synthetic-demo presentation are approved, use HTTPS ingress with target port
8787 and insecure ingress disabled. Do not expose the image merely because it
builds successfully.

Required runtime values (safe defaults are already in the image):

| Name                       | Value / purpose                                                         |
| -------------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                 | `production`; do not override to bypass the read-only guard             |
| `KASA_API_HOST`            | `0.0.0.0` inside the container only; local development remains loopback |
| `KASA_API_PORT`            | `8787` and matching ingress target                                      |
| `KASA_API_SERVE_WEB`       | `true`                                                                  |
| `KASA_API_DEMO_WRITES`     | `false`; never enable on public ingress                                 |
| `KASA_API_COUNTRY`         | `demo`; do not present a real market as approved                        |
| `KASA_API_ENV_FILE`        | `/app/no-runtime-env-file`; no local environment file is copied         |
| `KASA_API_ALLOWED_ORIGINS` | Exact approved HTTPS frontend origin(s), comma-separated, no wildcard   |

Do not set `KASA_API_DEMO_KEY` for this deployment. `VITE_` variables are public
build-time values, never a place for database credentials or private API keys.
No database connection variable is currently consumed by this app.

Configure explicit Azure HTTP probes on port 8787; do not assume Azure reads
the Docker `HEALTHCHECK`:

- Startup/liveness: `/api/v1/health` (process/listener reachable).
- Readiness: `/api/v1/ready` (synthetic API and bundled `dist/index.html` present).
- Readiness includes `mode: read_only_demo`, `data: synthetic`,
  `persistence: not_configured`, and **`productionReady: false`**.
- Missing web output returns readiness 503. Unknown `/api` paths, dotfiles and
  missing assets return 404 rather than a misleading successful SPA page.
- Health/readiness probes and static files do not consume the API user quota.
  Catalogue limits remain per-process, not a shared cross-replica limiter.

The catalogue's external photographs and current OpenStreetMap tile endpoint
remain demo dependencies. Preserve attribution; review provider terms, quotas,
privacy and the tile/geocoding contract before public production traffic. A map
rendering in this demo does not prove a paid provider has been configured.

## Release gates still open

On 3 October 2026, compatible lockfile updates to `qs` 6.16.0, `ip-address`
10.7.3 and development-only `brace-expansion` 5.0.12 resolved the reported npm
advisories. Full and production-only lockfile audits reported zero known
vulnerabilities at that time. The API still uses the simple query parser and JSON
bodies. Rate-limit regressions check equivalent IP addresses and distinct client
groups. These dependency checks do not replace the remaining production gates.

Confirm approved hostname/CORS, image provenance, bounded replicas/log retention,
health probes, remote catalogue rendering and rejection of both write routes.
Add a visible synthetic-demo context when presenting the app to third parties.
Keep real customer access disabled until identity/workspace authorisation,
transactional persistence and migrations, private documents, audit/retention,
abuse controls, backups/restore and country/provider decisions are implemented
and tested. Payments and custody restrictions remain unchanged.
