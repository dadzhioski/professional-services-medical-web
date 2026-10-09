# WEB-M0-002: Bootstrap the Next.js SSR foundation

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-001
- **Related ADRs:** WEB-ADR-0001
- **Risk:** Medium

## Goal

Create a minimal Next.js application with strict TypeScript, server-rendering defaults, Tailwind, typed environment configuration, unit tests, and a health route.

## Allowed scope

- Next.js App Router application;
- strict TypeScript, linting, Tailwind, and a small source-owned UI primitive;
- neutral development home page;
- `/healthz` route;
- Vitest and Testing Library;
- typed separation of server-only and public environment values;
- accessibility baseline.

## Non-goals

- no doctor UI, authentication, API integration, Playwright, analytics, or Docker image;
- no global state library or second UI framework.

## Requirements

1. Default pages are server components.
2. Server secrets cannot enter client bundles.
3. Invalid required environment configuration fails clearly.
4. Tests run non-interactively.

## Acceptance criteria

- [ ] Reproducible `npm ci` succeeds.
- [ ] Lint, typecheck, tests, and production build pass.
- [ ] `/healthz` returns HTTP 200 without environment details.
- [ ] Home page has semantic structure and basic accessibility assertions.

## Verification

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run start
curl --fail http://localhost:3000/healthz
```

## Security and privacy

Validate server/client environment boundaries. No analytics or personal data.

## Handoff

Report exact framework versions, scripts, and environment schema.
