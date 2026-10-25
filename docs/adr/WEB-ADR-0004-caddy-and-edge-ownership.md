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

## Amendment (2026-10-25, WEB-M1-008; proposed, awaiting human review)

Provider image uploads need longer than the web route's 10-second response timeout. The upload API re-encodes images of up to 10 MiB, and one upload action makes up to five sequential API calls. Raising the timeout for every web request would let any slow page hold the edge longer. Instead:

- A separate route covers only `POST` to the localized provider profile and credentials pages. It allows 50-second response-header and read timeouts (Caddy's read deadline also covers the wait for headers), a 30-second write timeout and 12 MB request bodies.
- The web caps each upload action at 40 seconds in total, so it always answers before the edge gives up.
- All other web requests keep the 10-second timeouts and gain a 1 MB request-body cap.
- The `/api/*` route, security headers, error handling, logging and forwarded-header trust are unchanged.

Integration checks cover:
- a slow upload completing;
- a stalled upload ending with the web's own outcome;
- the body limits;
- a slow client;
- owner image delivery through `/api/*`;
- log privacy.

A static check keeps the route's page list in step with the locale registry and the web budget.

## Enforcement

- Compose publishes only Caddy ports;
- Next.js has no production host port;
- routing tests verify `/api/*` preservation;
- production deploy workflow requires protected human approval; non-production permits manual dispatch without a separate approver (owner-authorized 2026-10-16);
- production secrets are referenced, never committed.
