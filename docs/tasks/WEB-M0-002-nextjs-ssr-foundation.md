# WEB-M0-002: Bootstrap the Next.js SSR foundation

- **Status:** IMPLEMENTED (pending owner review)
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

- [x] Reproducible `npm ci` succeeds.
- [x] Lint, typecheck, tests, and production build pass.
- [x] `/healthz` returns HTTP 200 without environment details.
- [x] Home page has semantic structure and basic accessibility assertions.

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

## Implementation evidence (2026-10-09)

- Exact framework versions: Next.js 16.4.0, React/React DOM 19.3.0,
  TypeScript 5.9.3, Tailwind 4.3.3. Node 24.19.0 and npm 11.17.0 remain pinned.
  All direct dependencies use exact versions; npm generated the lock file.
- Replaced placeholder scripts with dev, lint, typecheck, non-interactive test,
  build, and start commands. See README for the full version/script inventory.
- App Router layout and home are Server Components; the neutral home is
  prerendered at build time and its heading is present in the production HTTP
  response without JavaScript. No forced dynamic rendering is needed.
- Added translated application copy, semantic landmarks, keyboard skip target,
  visible focus styling, a responsive source-owned Surface, and noindex metadata.
- Added a fixed JSON health route with no-store and no environment details.
- Server configuration uses the server-only import guard. Required NODE_ENV
  accepts only development/test/production; Next.js/Vitest supply it.
  Public configuration is an immutable empty allowlist. No custom variables or
  secrets are needed. Invalid values fail with a message that does not echo them.
- Verified npm ci with an unchanged SHA-256 lock-file hash; lint, strict
  typecheck, 12 unit tests, and production build pass.
- Production npm run start smoke checks passed: /healthz returned HTTP 200,
  exactly {"status":"ok"}, and no-store; / returned HTTP 200 with the heading,
  language, skip link, and noindex metadata in initial HTML.
- A temporary Client Component importing server configuration caused the
  expected server-only build failure. Removed the probe and rebuilt successfully.
- Accessibility checks: Testing Library semantic assertions and axe structural
  audit pass. Color contrast is disabled in jsdom; real-browser visual,
  responsive, keyboard, and contrast checks were not executed. Playwright is
  explicitly outside this task and arrives in WEB-M0-004.
- Privacy: no personal data, forms, cookies, external fonts, or analytics added.
- API-client version: none installed, as required by this task's non-goals.
  Exact generated-client integration remains WEB-M0-003.
- Dependency limitation: production audit has zero vulnerabilities. Full audit
  reports five high entries from one braces advisory in the development lint
  dependency chain; no fixed braces release is available. ESLint 9.39.5 is
  deprecated but satisfies the Next lint plugins' peer ranges; ESLint 10 does
  not. Details and follow-up are recorded in README.
- npm ci warns that unrs-resolver's postinstall is not allowlisted. Installation
  and all checks pass without adding a blanket install-script approval.
