# WEB-M0-005 implementation plan

Planning date: 2026-10-13. Implemented on this branch; see
[verification evidence](../WEB-M0-005-verification.md) for completed checks and external prerequisites.

Branch: `codex/web-m0-005-production-compose-caddy`, based on WEB-M0-004 commit `fd5cea9`.

## Basis and current gaps

Follow [WEB-M0-005](WEB-M0-005-production-compose-caddy.md), [WEB-ADR-0004](../adr/WEB-ADR-0004-caddy-and-edge-ownership.md), [WEB-ADR-0005](../adr/WEB-ADR-0005-independent-release-compatibility.md), and [build-plan.md](../../build-plan.md).

The current Compose and Caddyfile establish routing and persistent Caddy volumes but are explicitly templates. Compose does not validate SHA syntax, Caddy has no health check, proxy deadlines are unspecified, and logs require privacy hardening. `.env.production.example` uses `sha-<40 hex>` while `scripts/image.mjs` and CI use bare `<40 hex>` tags. The web image already supplies non-root execution, health checks, revision/client labels, and a standalone server. The status wrapper already bounds API requests at five seconds and renders a translated unavailable state without logging dependency errors.

The exact generated client is `@dadzhioski/professional-services-api-client@0.2.0`; retain it and verify lockfile/image metadata consistency.

The sibling API-M0-007 task and backend Compose were read. The backend provides `api:8080` on an external network with a configurable name and no public API/database ports. Its task still says PLANNED; checked-in configuration alone does not prove an available compatible release. Record an explicitly selected full-SHA API image and observed API version before claiming real integration. Do not infer the API image from the client version.

## Implementation sequence

### 1. Validate configuration before starting containers

- Add small Node orchestration/validation modules under `scripts/`, with focused `node:test` tests and Make entry points. Use argument arrays for Docker commands and sanitized errors.
- Validate a web image ending in a bare 40-character lowercase hexadecimal commit tag, consistent with existing publication. Reject absent/empty tags, shortened hashes, `sha-` prefixes, branches, `latest`, and other mutable tags before mutation. Support valid registry host/port syntax deliberately.
- Require revision and client-version image labels to match selected inputs before integration startup. Share pure validation with existing image tooling where useful; avoid importing its command execution side effects.
- Replace the production example's incompatible tag format. Pin Caddy to a reviewed exact release and verified digest during implementation; do not invent a digest or treat the current example version as a verified choice.
- Run Compose config validation using synthetic inputs and inspect its resolved service, port, volume, and network model. Validate Caddy syntax with the selected Caddy image. Avoid dumping real environment values.

### 2. Complete production Compose and edge bootstrap

- Keep exactly two services: `web` and `caddy`. Only Caddy publishes 80/tcp, 443/tcp and, if retaining HTTP/3, 443/udp. Web has alias `web` and internal port 3000 on `professional-services-edge`.
- Keep Caddy `/data` and `/config` in named volumes and its Caddyfile mount read-only. Preserve bounded Docker log rotation and restart policies. Document initial CPU/memory limits and tune from measured startup/runtime behavior.
- Retain image health checks for web; add bounded Caddy health verification that stays useful during API failure. Do not make web/Caddy startup depend on API health. Keep the Caddy admin interface unpublished.
- Make `edge-network` inspect/create idempotently, handling a concurrent create safely. Never delete a pre-existing shared network on shutdown.
- Document Compose prerequisites and the minimum supported version, particularly any override syntax used by smoke mode.

### 3. Harden routing, TLS, headers, and logs

- Preserve `handle` routing for `/api/*` to `api:8080` without stripping `/api`; route all other paths to `web:3000`. Define and test `/api` itself explicitly without broadening the required matcher accidentally.
- Set finite proxy dial/response deadlines. Test missing DNS/upstream, refused connections, and stalled responses. Keep `/healthz` independent of API availability and `/system-status` server-rendered with the existing translated fallback.
- Return generic proxy-generated failures without upstream addresses or stack traces. Do not rewrite ordinary API business responses indiscriminately.
- Keep automatic HTTPS for approved production domains; use explicit HTTP only in domainless smoke mode. Review forwarding-header trust, remove unnecessary server disclosure, and verify security headers on success and errors. Apply HSTS only to HTTPS; avoid an untested CSP that breaks Next.js.
- Use privacy-minimizing structured access logs: allowlist method, sanitized path, status, duration and necessary operational fields; omit query strings, cookies, authorization, request bodies, and unnecessary client identifiers. Account separately for Caddy runtime error logs, which can expose upstream addresses and stack fields. Prove the selected logging policy preserves safe observability.
- No new browser environment variables or secrets. Keep the API origin server-only.

### 4. Build isolated domainless integration coverage

- Add a smoke override/configuration and integration harness. Reuse the production Caddyfile and routing logic; replace host bindings with a loopback-only ephemeral HTTP port. Assert resolved configuration has no inherited public 80/443 bindings. Disable certificate acquisition in this mode.
- Use a unique project and external test-network name per run, with aliases `web` and `api`. Never attach destructive outage tests to the production shared network. Track ownership so cleanup removes only resources created by that run.
- Use the existing synthetic transport fixture as test infrastructure, extending it with controlled timeout/failure behavior and request-path evidence. Keep controls unexposed to the host/public edge. This fixture is not an API deployment definition or compatibility proof.
- Add a separate read-only compatibility mode against an independently provisioned non-production API. Require explicit API image identity, expected API version, and client version; verify available identity evidence and routing. If that environment is unavailable, report the check unexecuted rather than silently substituting the fixture.
- Outage tests may stop/disconnect only the harness-owned fixture. No web command starts, stops, deploys, migrates, or removes actual API/PostgreSQL containers.

### 5. Prove acceptance and wire CI

| Check | Evidence |
|---|---|
| Configuration and image policy | Synthetic Compose/Caddy validation; negative image cases; exactly two production services; only Caddy host ports; external network and persistent mounts |
| Routing and SSR | `/healthz` and `/system-status` through Caddy; raw HTML and JavaScript-disabled browser checks; exact `/api/v1/system/status` path observed upstream; static assets load |
| Failure and recovery | Fixture absent, connection failure, HTTP error, and stalled response; bounded generic proxy failure and translated SSR fallback; health remains 200; recovery without restarting web |
| Restart | Restart/recreate web and Caddy only; check Caddy volume identity and synthetic persistence marker; compare fixture container ID/start time/restart count; repeat routes |
| Privacy and headers | Inject synthetic token/query/cookie/error canaries; inspect responses, browser assets, and both service log streams; assert no canaries, internal URLs, or stack traces; verify header behavior |
| Accessibility | Desktop/mobile Chromium, JavaScript-disabled content, skip-link/focus, overflow, and axe checks for healthy/unavailable pages through Caddy |
| Real compatibility | Explicit selected API image, observed API version, client 0.2.0, and successful route/SSR evidence; report separately from fixture results |

Add all seven task targets to Makefile: `validate-production-config`, `edge-network`, `integration-up`, `integration-routing-test`, `integration-api-unavailable-test`, `integration-restart-test`, `integration-down`. Document required environment inputs and an ordered local run. Integration teardown must run on failure and preserve production volumes/networks. Keep ordinary teardown distinct from disposable test cleanup.

Extend CI after its existing runtime image build to run synthetic Caddy integration with bounded timeouts and unconditional owned-resource cleanup. Store only sanitized diagnostics with short retention. Reuse the current private-package credential boundary and pinned actions. Do not add production deployment workflows here; those belong to WEB-M0-006.

### 6. Documentation and review handoff

Update `deployment/README.md`, `.env.production.example`, CI/image documentation, and the task status only as evidence warrants. Document image identifiers, ports, routes, aliases, volumes, restart behavior, health semantics, resource guidance, secret-file handling, and HTTP smoke versus production TLS prerequisites.

Present concrete configuration for the task-required human review of public ports, domains, TLS behavior, forwarded headers, log retention, secret injection, and security headers. Real DNS, real certificate issuance, and production execution remain outside this task. Protected production approval and rollback automation belong to WEB-M0-006.

## Verification commands for implementation

Run `npm run check:api-client-version`, `npm run test:policy`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run e2e`. Build and smoke-test the image, then run the seven task Make targets in their documented order with synthetic inputs and the isolated test network. Run the new Caddy browser suite and security/container checks affected by image or log changes. Finally perform the separately configured real-API compatibility check when its prerequisite release is available.

No application, infrastructure, or test execution is part of this planning change. Lint, type checking, unit/policy tests, build, Playwright, image build/scan, Compose/Caddy validation, routing/outage/restart tests, and real-API compatibility checks are unexecuted at planning time. SSR and accessibility behavior are unchanged; privacy impact is limited to a documentation addition with no credentials or personal data.
