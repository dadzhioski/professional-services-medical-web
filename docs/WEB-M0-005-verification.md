# WEB-M0-005 verification — 2026-10-13

Implemented on `codex/web-m0-005-production-compose-caddy`. Changes are local and uncommitted; no images were published and no production deployment was performed.

## Verified artifacts and boundary

Both development images use the current base revision tag `fd5cea949323fdc72eb56afce20847d93fd8618b`. Because the checkout contains uncommitted changes, these are local test artifacts, not immutable published releases.

| Artifact | Local identity |
| --- | --- |
| Web | `professional-services-medical-web:fd5cea949323fdc72eb56afce20847d93fd8618b` |
| Web image ID | `sha256:80d338982b468980382ab994303d8cdfa23887db56ad25943fd934aed9f4b406` |
| Edge | `professional-services-medical-edge:fd5cea949323fdc72eb56afce20847d93fd8618b` |
| Edge image ID | `sha256:e4d873fc675709b5b76ca2e2a1d4862f86c33d015294055742cf5ce893c088dc` |
| API client | `@dadzhioski/professional-services-api-client@0.2.0` |
| Synthetic API status version | `0.2.0` (transport fixture only) |
| Real API image/version | Not selected or verified; no independent API was running locally |

Production Compose has only web and Caddy. Caddy alone publishes 80/tcp, 443/tcp and 443/udp; web is internal at `web:3000`, API routing targets `api:8080`, and Caddy's admin endpoint is container-loopback on 2019. `/api/*` preserves its prefix and query; all other paths route to web. The external production network is `professional-services-edge`. Named `caddy-data` and `caddy-config` volumes survive restart and recreation. Smoke runs replace public bindings with one random loopback HTTP port and own their random network/project/fixture.

## Completed checks

Commands were run directly through the Node/npm entry points behind Make targets on Windows with Docker Desktop Linux containers.

| Check | Result |
| --- | --- |
| `npm run check:api-client-version` | Pass: exact 0.2.0 and matching lockfile |
| `npm run lint` | Pass, zero warnings |
| `npm run typecheck` | Pass |
| `npm test` | 59 tests pass |
| `npm run test:policy` | 35 tests pass, including image/site validation, topology exposure and Go scan coverage |
| `npm run build` | Pass; `/system-status` and `/healthz` remain dynamic server routes |
| `npm run e2e` | 6 desktop/mobile Chromium tests pass |
| `node scripts/image.mjs build` / `smoke` | Pass |
| `node scripts/edge-image.mjs` | Pass: Caddy 2.11.7 rebuilt with Go 1.26.9 and x/net 0.60.0 |
| `node scripts/integration.mjs validate` | Production/smoke resolved topology and both HTTP/HTTPS Caddy syntax pass |
| `node scripts/integration.mjs up` | Pass; image metadata, health, isolated network bootstrap and idempotency checked |
| `node scripts/integration.mjs routing` | Pass: SSR, health, static assets, path/query preservation, forwarded-header spoof rejection, headers and private-data canaries |
| `node scripts/integration.mjs unavailable` | Pass: HTTP error, stalled response, refused connection, missing DNS and recovery |
| `node scripts/integration.mjs restart` | Pass: web/Caddy restart and recreation; persistent markers and volumes; fixture identity/start time/restart count unchanged |
| `npx --no-install playwright test --config playwright.integration.config.ts` | 8 tests pass against the final rebuilt Caddy image |
| `node scripts/integration.mjs down` | Pass; owned containers/networks removed and cleanup independently checked |
| `node scripts/security.mjs container` | Web: zero high/critical vulnerabilities and zero secrets |
| `node scripts/security.mjs edge-container` | Rebuilt edge: zero high/critical vulnerabilities and zero secrets |
| `node scripts/security.mjs secrets` | History/source pass; controlled negative detection probe passes |
| `npm run security:dependencies` | Pass under the existing approved five-finding development-only exception expiring 2026-10-26; no new exception |
| Workflow YAML parsing / `git diff --check` | Pass |

Initial Windows-sandbox type generation/build failed on compiler path access, and two unit suites failed on sandbox temporary files. All passed when rerun outside that sandbox. A smoke restart initially exposed Docker's reassignment of an ephemeral port; the harness now rediscovers it after restart and recreation, and both checks passed. The upstream Caddy image initially had four high findings in Go/x/net; the rebuilt image resolves them and passes the unchanged high/critical policy.

## SSR, accessibility, and privacy

No application rendering or translation changes were required. JavaScript-disabled status content, desktop/mobile layout, skip-link keyboard focus and axe checks pass through Caddy for both healthy and unavailable states. No patient data, runtime secrets, browser API-origin exposure, or new client-side API calls were introduced. Synthetic authorization/cookie/query/error canaries are absent from service logs and client assets; safe access status/timing remains observable. No backend or database container was started, stopped, restarted or modified.

## Unexecuted checks and review gates

- Real API-M0-007 compatibility: requires an independently provisioned non-production API and explicit image/version inputs for `make integration-compatibility-test`. Synthetic success does not close this acceptance criterion.
- Real DNS, ACME certificate issuance/renewal, browser HTTPS/HSTS behavior, public host bindings, production load/resource sizing, deployment and rollback: not executed; domainless tests and configuration validation do not prove them.
- GitHub-hosted CI and two-package GHCR publication: workflow updated and YAML parsed locally, but neither remotely executed. Publishing remains guarded by the existing repository variable and trusted main-branch conditions.
- The actual shared production edge network was not created. The same bootstrap helper was exercised twice on the owned test network and preserved its identity.
- Task-required human review of ports, domain/TLS/HSTS, forwarded headers, log retention, secret boundary and security headers remains pending. Protected production execution is a separate WEB-M0-006 concern.

See [deployment instructions](../deployment/README.md) for exact inputs, runtime behavior, security tradeoffs and cleanup procedures.
