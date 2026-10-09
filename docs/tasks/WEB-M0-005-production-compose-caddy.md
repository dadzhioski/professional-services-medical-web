# WEB-M0-005: Add production web Compose, Caddy, and routing tests

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-004, API-M0-007
- **Related ADRs:** WEB-ADR-0004, WEB-ADR-0005
- **Cross-repository dependency:** API service available as `api:8080` on `professional-services-edge`
- **Risk:** High

## Goal

Run the immutable web image behind the single public Caddy instance and prove safe routing to the independently deployed API.

## Allowed scope

- production Compose for Caddy and medical web;
- Caddyfile template for automatic TLS, web routing, `/api/*` proxying, headers, and bounded logs;
- idempotent edge-network bootstrap;
- volumes, health checks, restart policies, and resource guidance;
- synthetic local/domainless smoke mode;
- routing, SSR, API-unavailable, and restart tests;
- production prerequisite and environment documentation.

## Non-goals

- no API or PostgreSQL container definition, Flyway, database credential, real DNS change, certificate issuance, VPS purchase, or production deployment;
- no mutable web/API image tags or host exposure for Next.js.

## Requirements

1. Caddy is the only service publishing ports 80/443.
2. Next.js is reachable only inside the edge network under alias `web`.
3. `/api/*` is forwarded to `api:8080` without losing the `/api` prefix.
4. A missing API produces a bounded safe web state; Caddy and the web remain observable.
5. Web image input is a validated full commit-SHA tag.
6. Secrets and internal URLs do not enter client bundles or logs.
7. Ordinary restart preserves Caddy state and requires no backend restart.

## Acceptance criteria

- [ ] Compose config validates with synthetic values.
- [ ] Only Caddy publishes host HTTP/HTTPS ports.
- [ ] Web health and server-rendered status page pass through Caddy.
- [ ] `/api/v1/system/status` reaches the API through Caddy with its path preserved.
- [ ] API-unavailable behavior is safe and tested.
- [ ] Missing, shortened, mutable, and `latest` image tags are rejected.
- [ ] Restart does not restart or require control of backend containers.
- [ ] Logs contain no secret, token, or internal stack trace.

## Verification

```bash
make validate-production-config
make edge-network
make integration-up
make integration-routing-test
make integration-api-unavailable-test
make integration-restart-test
make integration-down
```

## Security and privacy

Human review is required for public ports, domains, TLS behavior, proxy headers, log retention, secret injection, and security headers.

## Handoff

Report image identifiers, public/internal ports, routes, networks, volumes, health behavior, API version/client version, and every unexecuted check.
