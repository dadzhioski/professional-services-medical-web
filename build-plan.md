# Professional Services Medical Web — Build Plan

**Status:** Draft v0.3 — two-repository revision  
**Last updated:** 2026-10-01  
**Repository:** `professional-services-medical-web`

## 1. Product context

The first product is a trusted promotional web presence for doctors. Public visitors can understand a doctor's qualifications, credentials, services, and locations and may submit an appointment request. The doctor does not need to perceive the product as a calendar replacement.

The future trades product will have a separate brand and frontend repository. Reuse comes through the shared API model and proven components, not by mixing doctors and tradespeople in one interface.

## 2. Repository model

The platform uses exactly two repositories:

| Repository | Responsibility |
|---|---|
| `professional-services-platform-api` | Spring Boot API, database, OpenAPI/client package, backend deployment |
| `professional-services-medical-web` | Next.js medical product, Caddy/public ingress, frontend deployment |

This repository owns the medical user experience and public edge. It consumes, but does not redefine, the backend contract.

## 3. Product principles

1. Profile first, transaction second.
2. Public doctor pages are server-rendered, indexable, fast, accessible, and mobile-first.
3. Visitors submit requests with minimal information and no required account.
4. The UI must not solicit diagnoses, records, prescriptions, referrals, patient files, or detailed symptoms.
5. Business decisions and authorization remain in the API.
6. User-facing terminology is medical-specific; generic platform abstractions do not leak into copy.
7. Dependencies, environment boundaries, and commands remain explicit for coding agents.
8. Human approval protects privacy, analytics, authentication, and production deployment.

## 4. MVP success criteria

- public doctor profile pages have correct title, description, canonical URL, social metadata, and structured data;
- profile, services, credentials, and location content render without client-side JavaScript dependence;
- appointment requests require minimal contact information;
- provider and administrator views support the agreed workflow;
- loading, unavailable, validation, and error states are safe and accessible;
- no server secret enters a client bundle;
- integration with an exact generated API client is reproducible;
- Caddy is the only public entry point;
- web deployment and rollback are documented and protected.

## 5. Technology decisions

| Area | Decision |
|---|---|
| Framework | Next.js App Router and React |
| Language | TypeScript strict mode |
| Rendering | Server rendering by default for public pages |
| Styling | Tailwind CSS and a small source-owned component set |
| API | Exact generated `@dadzhioski/professional-services-api-client` version |
| Tests | Vitest, Testing Library, Playwright |
| Edge | Caddy with automatic HTTPS |
| Runtime | Docker Compose on Ubuntu LTS |
| Registry/CI | GitHub Actions and GHCR |
| Hosting | EU Ubuntu VPS; Hetzner preferred when suitable capacity is available |

Exact versions are selected and pinned during bootstrap. Floating package or image tags are prohibited.

## 6. Frontend architecture direction

```text
src/
├── app/
├── features/
│   ├── professional-profile/
│   ├── appointment-request/
│   ├── provider-dashboard/
│   └── administration/
├── components/
├── lib/
│   ├── api/
│   ├── config/
│   └── seo/
└── styles/
```

Public routes are server components by default. Client components are introduced only for actual interaction. API access passes through a server-owned wrapper around the generated client.

## 7. Contract and compatibility

- never copy or handwrite API DTOs;
- pin one exact API-client version in `package.json` and the lock file;
- request missing behavior through a linked API task;
- record the client version in web image metadata;
- test the web image against an explicitly selected compatible API image;
- deploy additive API changes before dependent web changes.

## 8. Deployment boundary

This repository owns:

- the non-root Next.js standalone image;
- production Compose for web and Caddy;
- ports 80/443, automatic TLS, and routing;
- the external `professional-services-edge` network bootstrap;
- web deployment, cross-repository routing smoke tests, and web rollback.

It does not own PostgreSQL, Flyway, API deployment, database backups, or backend secrets.

Caddy routes:

- `/api/*` to `api:8080` on the shared edge network;
- every other public route to `web:3000`;
- no database or internal administration port to the host.

## 9. Milestones

### Milestone 0 — Product and engineering foundation

Create the repository, agent governance, Next.js SSR baseline, generated-client integration, tests, CI/image publishing, production-shaped web/Caddy Compose, protected deployment/rollback, cross-repository smoke tests, and clean-room verification. No doctor product feature is implemented.

### Milestone 1 — Public doctor profile and provider onboarding

SEO profile route, credentials, services, locations, media, provider editing, administrative approval, and accessibility validation.

### Milestone 2 — Appointment-request experience

Minimal request form, consent, confirmation states, signed cancellation flow, provider decisions, and safe email-linked pages.

### Milestone 3 — Pilot readiness

Analytics, performance budgets, structured-data validation, production observability, privacy review, and pilot onboarding.

## 10. Milestone 0 execution

The authoritative task order is in `docs/backlog/milestone-0.md`. Every implementation task must:

1. target only this repository;
2. cite relevant ADRs;
3. state allowed scope and non-goals;
4. define observable acceptance criteria;
5. provide exact verification commands;
6. report accessibility, SSR, privacy, and unexecuted checks.

Milestone 0 ends only after clean installation, SSR/API integration, Caddy routing, image smoke tests, and protected non-production deployment/rollback succeed.

## 11. Deferred decisions

- final visual identity and design tokens;
- production analytics provider and consent implementation;
- authentication screens and provider onboarding flow;
- localization beyond the first market;
- extraction of shared components after a real trades frontend proves the need.

Do not resolve deferred decisions incidentally inside unrelated tasks.
