# Web and public-edge deployment boundary

This directory owns only Next.js, Caddy, TLS, public routing, web deployment, and web rollback. It must never acquire PostgreSQL, Flyway, backup, restore, or API deployment credentials.

## Intended host layout

```text
/opt/professional-services/web/     checked-out deployment assets
```

`compose.yaml` and `Caddyfile` are initial topology contracts. `WEB-M0-005` must validate and harden them against the actual web/API images before production use.

## Shared network contract

- external Docker network: `professional-services-edge`
- Next.js alias: `web`, internal port `3000`
- Spring Boot alias: `api`, internal port `8080`
- Caddy is the only publisher of host ports 80/443

Create the shared network idempotently during host bootstrap:

```bash
docker network inspect professional-services-edge >/dev/null 2>&1 || \
  docker network create professional-services-edge
```

Ordinary shutdown must not remove the shared network.

## Routing contract

- `/api/*` is proxied to `api:8080` with the `/api` prefix preserved;
- all other paths are proxied to `web:3000`;
- backend and database lifecycle remain outside this Compose project.

For local smoke testing set `SITE_ADDRESS=http://localhost`. Production uses the approved domain and Caddy-managed HTTPS.

## Release rules

- use an immutable web image tagged with the full Git commit SHA;
- record the exact generated API-client version embedded in that image;
- validate routing against a compatible healthy API before replacement;
- record the previous web image/configuration;
- rollback only web/Caddy; never restart API or PostgreSQL.

Scripts and workflows are intentionally created and proven by WEB-M0-005 and WEB-M0-006, not assumed complete in this planning template.
