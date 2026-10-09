# Medical Web Coding Agent Instructions

This repository owns the Next.js medical web product.

## Required reading

Before editing, read:

1. this file;
2. the assigned `docs/tasks/WEB-*.md` file;
3. referenced WEB ADRs;
4. relevant source and tests;
5. `build-plan.md` and any linked cross-repository task when applicable.

## Repository boundary

This repository owns:

- Next.js, React, and strict TypeScript;
- public medical profile pages and SEO;
- provider and administrator web interfaces;
- accessibility and responsive behavior;
- Vitest and Playwright tests;
- exact API-client package consumption;
- medical-web Docker image;
- production web Compose configuration;
- the single public Caddy instance, TLS, and edge routing;
- web deployment, integration smoke tests, and rollback.

It must not contain Spring Boot source, database migrations, backend business rules, canonical API definitions, PostgreSQL administration, API deployment, or database backup workflows.

## Frontend rules

- Public pages are server-rendered.
- Business decisions remain in the API.
- Use the generated API client; do not duplicate API DTOs.
- Pin the API-client package to an exact version without `^`, `~`, wildcard, or `latest`.
- A required API change becomes a linked API task; do not work around it with invented client fields.
- Use strict TypeScript and semantic accessible HTML.
- User-visible text uses translation keys.
- Do not add a global state library or second UI framework without approval.
- Do not collect detailed medical information.

## Deployment rules

- The web repository owns the only public Caddy instance and ports 80/443.
- Caddy routes `/api/*` to the API alias `api:8080` on the external `professional-services-edge` network and all other requests to Next.js.
- This repository deploys only Caddy and the web application; it never restarts or migrates PostgreSQL.
- Production images use immutable full-commit-SHA tags; `latest` is forbidden.
- Cross-repository smoke tests use an explicitly selected API image/client version.
- A real production deployment always requires protected human approval.
- Do not place production secrets, hostnames, or personal data in source control.

## Verification and handoff

Run lint, type checking, unit tests, production build, and affected Playwright tests. Report the exact API-client version, SSR impact, accessibility checks, privacy impact, and every unexecuted check.
