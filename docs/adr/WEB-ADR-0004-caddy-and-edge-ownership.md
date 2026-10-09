# WEB-ADR-0004: Keep Caddy and public ingress with the web repository

- **Status:** Accepted
- **Date:** 2026-10-01
- **Related tasks:** WEB-M0-004, WEB-M0-005, WEB-M0-006

## Context

Only one service may own public ports 80 and 443. Duplicating Caddy across repositories would create port conflicts and ambiguous TLS/routing ownership.

## Decision

The medical-web repository owns:

- the single public Caddy instance;
- automatic TLS and public domain routing;
- production Compose for Caddy and Next.js;
- the external `professional-services-edge` network bootstrap;
- web deployment and rollback;
- routing smoke tests covering the web and `/api/*`.

Caddy reaches Next.js through alias `web:3000` and the API through alias `api:8080`. This repository never manages PostgreSQL or runs Flyway.

## Consequences

- public exposure has one clear owner;
- backend remains deployable without granting web workflows database access;
- initial server setup must create the shared external network;
- Caddy routing changes require web-repository review.

## Enforcement

- Compose publishes only Caddy ports;
- Next.js has no production host port;
- routing tests verify `/api/*` preservation;
- deploy workflow requires protected human approval;
- production secrets are referenced, never committed.
