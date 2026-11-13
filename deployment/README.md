# Web and public-edge deployment

WEB-M0-005 implements the web-owned edge described by WEB-ADR-0004 and WEB-ADR-0005. Releases are deployed with the manual `Deploy web` workflow described below. This project defines only web and Caddy; the API repository independently provides `api:8080`.

## Prerequisites and inputs

Use Docker Engine with Linux containers, Compose **2.24.4 or newer**, Node 24.19.0, npm 11.17.0, and GNU Make (or run the Node commands listed in Makefile on Windows). Configure private-package read access before building the web image. Production requires an approved domain, correct DNS, inbound TCP 80/443 and UDP 443 if using HTTP/3, outbound certificate-authority access, and storage for Caddy state. No real DNS/certificate/production operation is needed for local verification.

Keep actual configuration outside Git. `.env.production.example` contains synthetic values only. The validator accepts `WEB_IMAGE` and `SITE_ADDRESS` from the process environment. A production image must use a bare 40-character lowercase commit-SHA tag, matching CI publication; `sha-` prefixes, short hashes and mutable tags fail validation. Run validation before any later deployment command; Compose interpolation by itself only checks presence and is not the SHA policy gate.

| Input | Contract |
| --- | --- |
| `WEB_IMAGE` | Full-SHA web image; local smoke defaults to the current HEAD image |
| `SITE_ADDRESS` | One approved DNS hostname, optionally prefixed by `https://`; validation defaults to `medical.example.test` |
| `PUBLIC_ORIGIN` | Exact HTTPS web origin matching `SITE_ADDRESS`; the deploy workflow supplies `WEB_DEPLOY_ORIGIN` |
| `EDGE_NETWORK` | Host bootstrap defaults to `professional-services-edge`; integration always uses its own random network |
| API client | Exact `@dadzhioski/professional-services-api-client@0.7.0`; smoke checks the image label against package/lock files |
| `CADDY_IMAGE` | Full-SHA `professional-services-medical-edge` image; local checks default to current HEAD |

The edge image rebuilds Caddy 2.11.7 with Go 1.26.10 `golang.org/x/net@v0.60.0` and `github.com/go-jose/go-jose/v4@v4.1.6` to fix high scanner findings in the upstream binary (Go 1.26.10 fixes CVE-2026-111943 in `crypto/x509`). The unfixed go-jose v3 finding has a temporary owner-approved exception that expires 2026-11-11 (see `docs/ci-and-images.md`). Compiler and runtime base digests are pinned in `Dockerfile.caddy`; no new Caddy plugins are added. Build it with `make edge-image`. Release context is available in the [upstream releases](https://github.com/caddyserver/caddy/releases/tag/v2.11.7). Local images built with uncommitted changes are development evidence, not publishable releases.

## Runtime boundary

WEB-M1-003 adds required server-only `PUBLIC_ORIGIN`. The deploy workflow
passes `WEB_DEPLOY_ORIGIN` to Compose, which passes it into the web container.
The runtime value is independent of the synthetic Docker build value. When
present it must match the approved site.

Before live provider acceptance, the API owner must confirm compatible identity
behavior, the same public origin, Google callback configuration and exact return
paths `/mk/provider`, `/en/provider`, `/bg/provider`, `/sq/provider` (plus the API's
required `/`). Test login, return and logout with synthetic accounts through the
site origin in all locales, then expiry and safe unavailable states. Local browser
fixtures are not live Google acceptance. This change does not authorize deployment.

Only Caddy publishes 80/tcp, 443/tcp and 443/udp. Web exposes 3000 only inside the external edge network under alias `web`. Its API origin is fixed server-side to `http://api:8080`; it is never a `NEXT_PUBLIC_*` value. The API and PostgreSQL are not services in this project.

`make edge-network` idempotently creates the external host network. Ordinary shutdown must preserve it. Caddy owns named `caddy-data` and `caddy-config` volumes; never use `down --volumes` on the production project. `/etc/caddy/Caddyfile` is mounted read-only. Web runs as the image's non-root user with all capabilities dropped. Both services use `unless-stopped` and `no-new-privileges`.

Initial limits are 512 MiB/1 CPU for web and 256 MiB/0.5 CPU for Caddy. These are starting limits, not load-tested capacity claims; measure memory, latency and OOM events under expected traffic before production.

Web's image health check calls its own `/healthz`, independently of the API. Caddy's health check reads its loopback-only admin configuration endpoint on 2019; that endpoint is never published. End-to-end checks additionally verify `/healthz` through the public edge. An API outage does not require either web or Caddy to restart.

## Routing and privacy

- `/api/*` reaches `api:8080` with the complete path and query preserved. Bare `/api` follows the web route and currently returns 404.
- Other paths reach `web:3000`; `/system-status` remains dynamically server-rendered and renders its translated fallback after a bounded API failure.
- API proxy dial timeout is 2 seconds and header/read/write timeouts are 6 seconds. Web proxy dial timeout is 2 seconds and header/read/write timeouts are 10 seconds. The web API wrapper retains its five-second abort.
- Image uploads (WEB-M1-008) have their own route: `POST` to `/{locale}/provider/profile` or `/{locale}/provider/credentials` waits up to 50 seconds for the response (header and read timeouts; Caddy's read deadline also covers the wait for headers), allows 30 seconds for writing the request to the web, and accepts bodies up to 12 MB.
  - The web bounds each upload action at 40 seconds in total (upload call 25 seconds, other calls 5 seconds each). Users therefore get the web's translated outcome rather than an empty edge 504.
  - Every other web request body is capped at 1 MB, which matches the Next.js Server Action default; Caddy answers oversized bodies with an empty 413.
  - `make validate-production-config` checks that the route lists exactly the localized pages that render image uploads, and that the web budget ends at least 5 seconds before the edge timeout.
- Proxy-generated failures have an empty response body and safe HTTP error status. Ordinary API responses, including business errors, retain their contract; the edge does not sanitize arbitrary API business payloads.
- Caddy trusts no external forwarded-header sender. Tests inject spoofed forwarded values and verify replacement. Adding another trusted proxy requires review.
- Responses remove `Server`, set `nosniff` and `strict-origin-when-cross-origin`, and set one-year HSTS on HTTPS only, without preload or includeSubDomains. No new CSP is introduced.
- Access logs omit the complete request object, response headers, user ID and error trace/ID. They retain status, timing, size and a constant `api`/`web` route category instead of arbitrary URLs. Raw `http.log.error` logs are excluded because they contain upstream/request details; safe access statuses and health checks remain observable. Runtime startup/TLS diagnostics remain available.
- Docker rotates each service's logs at 10 MiB, retaining five files (approximately 50 MiB/service). This is a size bound, not a time-based retention promise. Never enable debug/request-body logging or credentials logging in production.

See Caddy's [logging reference](https://caddyserver.com/docs/caddyfile/directives/log) and [proxy reference](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) for the reviewed directives. No runtime application secret is required for the current status page. Registry/build credentials remain transient and outside Compose/source control. Future runtime secret injection must be separately reviewed.

## Isolated local verification

Build the current web image, then run:

```sh
make image
make edge-image
make validate-production-config
make integration-up
make integration-routing-test
make integration-api-unavailable-test
make integration-upload-test
make integration-restart-test
make integration-browser-test
make integration-down
make edge-container-scan
```

Always run `integration-down` after a failed manual run, too. `make integration-test` runs validation, startup, routing/outage/restart and cleanup in a finally block; the browser target is separate and requires the stack to remain up. CI uses the individual targets and an unconditional cleanup step. `make edge-network` is a host-bootstrap command, not a prerequisite for isolated smoke; test startup owns its own external network.

The smoke override uses the production Caddyfile and images, explicitly replaces production port bindings with one random loopback HTTP port, and requests no certificate. Each run owns a random Compose project, labeled network and synthetic transport container. `reports/integration-state.json` records only synthetic resource identities and the discovered origin. One run per checkout is supported; a second startup refuses to overwrite its state. Outage controls listen only on fixture loopback and are invoked through Docker exec. Only the harness-owned fixture can be disconnected; no actual API container is controlled.

Tests prove path/query preservation, spoofed-forwarding rejection, raw SSR, static assets, independent health, HTTP error/stall/refused/missing-DNS failure modes, recovery, token/query/cookie canary absence in logs, and persistent Caddy volume markers. Restart and force-recreation compare the fixture identity/start time/restart count and rediscover the ephemeral port. Desktop/mobile browser checks prove JavaScript-disabled content, focus/skip-link behavior, overflow and axe results for success and outage states.

Smoke cleanup removes only its own project/volumes, labeled fixture and labeled network. It never removes the host edge network or backend resources. CI prints sanitized check summaries rather than uploading raw container logs. The Caddy and web scans reject high/critical vulnerabilities and secrets and require OS plus application inventories.

## Independently deployed API compatibility

Synthetic fixtures prove transport behavior, not real release compatibility. Provision a disposable non-production API using its own repository and expose a matching web/Caddy stack on a loopback HTTP port. This repository provides no backend startup or teardown command.

Set `API_IMAGE` to the chosen full-SHA API image, `EXPECTED_API_VERSION` to the expected status version, `API_CONTAINER` to that running container, `COMPATIBILITY_WEB_CONTAINER` and `COMPATIBILITY_CADDY_CONTAINER` to the matching web/edge containers, and `COMPATIBILITY_ORIGIN=http://127.0.0.1:<port>`. Run `make integration-compatibility-test`.

The checker is read-only: it verifies image identity, shared aliases, actual Caddy port binding, client metadata, API status/version, SSR and health. It rejects the synthetic fixture label and requires all inputs explicitly. Missing prerequisites mean this check is unexecuted, not passed. Local inspection during implementation found no running independent API.

## Deploying to the VPS

The manual `Deploy web` workflow (`.github/workflows/deploy-web.yml`) deploys a
published release. It mirrors the API repository's deploy: SSH to the host,
copy this commit's `deployment/compose.yaml` and `deployment/Caddyfile` into a
fresh release directory, and run Compose for `web` and `caddy` only. It never
touches the API, PostgreSQL or their Compose project, and runs no backend checks.

Inputs: `environment` (`non-production` or `production`) and `sha`, the full
40-character lowercase commit whose `professional-services-medical-web` and
`professional-services-medical-edge` images CI published to GHCR. Dispatch it
from `main`; the job is bound to the selected GitHub environment, so its
protection rules (required reviewers for production) apply.

On the host the workflow, holding `flock` on
`/opt/professional-services/web-state/operation.lock`:

1. creates `/opt/professional-services/web-releases/<run id>-<attempt>` and
   copies the two files there (Compose mounts `./Caddyfile` from that directory);
2. runs `docker compose -p professional-services-medical-web -f <dir>/compose.yaml
   up -d --pull always --wait --wait-timeout 120 web caddy` with `WEB_IMAGE`,
   `CADDY_IMAGE`, `SITE_ADDRESS` (hostname of `WEB_DEPLOY_ORIGIN`),
   `PUBLIC_ORIGIN` (`WEB_DEPLOY_ORIGIN`) and `EDGE_NETWORK=professional-services-edge`;
3. records the SHA in `web-state/current` (the replaced SHA moves to
   `web-state/previous`; every deploy is appended to `web-state/history`) and
   removes release directories older than an hour other than the active one.

The runner then checks `<origin>/healthz` over HTTPS. On failure the job log
shows `docker compose ps --all` and the last 100 log lines of `web` and `caddy`.
Nothing is rolled back automatically.

**Rollback:** run `Deploy web` again with the previous SHA (printed at the end of
each deploy log and stored in `web-state/previous`). The fixed project name keeps
the named `caddy-data`/`caddy-config` volumes, so certificates survive deploys
and rollbacks. Never run `down --volumes` on this project.

GitHub environment settings (per environment; never commit real values):

| Name | Kind | Purpose |
| --- | --- | --- |
| `WEB_DEPLOY_ENABLED` | Variable | Must be `true` |
| `WEB_DEPLOY_HOST` | Variable | VPS hostname or IPv4 address |
| `WEB_DEPLOY_PORT` | Variable | SSH port |
| `WEB_DEPLOY_USER` | Variable | Host account that may run `docker compose` (for example the API's `github-deploy` account) |
| `WEB_DEPLOY_KNOWN_HOSTS` | Variable | Pinned host-key line(s); use `[host]:port` for a non-default port |
| `WEB_DEPLOY_ORIGIN` | Variable | Exact HTTPS origin, no trailing slash |
| `WEB_DEPLOY_SSH_KEY` | Secret | Private key authorized for `WEB_DEPLOY_USER` |

Host prerequisites: Docker with Compose 2.24.4+, `flock`, the external
`professional-services-edge` network, `/opt/professional-services` writable by
the deploy account, and GHCR pull access for both web packages in that account's
Docker configuration if the packages are private. The deploy account can operate
Docker and therefore is root-equivalent on the host; protect its key accordingly.

## Human review before production

Review the concrete public bindings, domain/TLS/HSTS behavior, forwarding trust, size-bounded log policy, omission of raw proxy errors, secret boundary, and security headers in this change. Production deployment requires owner authorization and the production environment's required reviewers. Domainless tests do not prove real certificate issuance, DNS or production capacity.
