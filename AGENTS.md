# Medical Web Coding Agent Instructions

This repository owns the Next.js medical web product and the single public edge (Caddy) for the Professional Services Platform.

## Required reading

Always read:

1. this file;
2. the assigned `docs/tasks/WEB-*.md` file.

Read the following only when the task references them or they are clearly relevant:

3. referenced WEB ADRs in `docs/adr/`;
4. relevant source and tests;
5. `build-plan.md`, `docs/backlog/milestone-0.md`, and any linked cross-repository (API) task;
6. `deployment/README.md` and `docs/ci-and-images.md` for edge, image, CI, or deployment work.

If the task file is missing, ambiguous, or conflicts with this file, stop and ask. Do not improvise.

## Repository boundary

### Milestone 1 authorization (2026-10-16)

The owner authorized Milestone 1 frontend planning and implementation before formal Milestone 0 closure. When creating or executing Milestone 1 tasks, read `docs/backlog/milestone-1.md` and the deferred-work register in `docs/backlog/milestone-0.md`. Do not make deferred Milestone 0 acceptance, rollback proof, hosted evidence, documentation reconciliation, or owner sign-off prerequisites for unrelated frontend tasks, and do not ask again for permission to start Milestone 1. Those items remain open, not passed or waived. Actual feature-specific API dependencies, existing quality/security gates, the dependency-exception expiry, and production approval requirements still apply; a failed check blocks the affected validation/release, not unrelated task planning.

This repository owns:

- Next.js App Router, React, and strict TypeScript;
- public medical profile pages and SEO;
- provider and administrator web interfaces;
- accessibility and responsive behavior;
- Vitest, Testing Library, and Playwright tests;
- consumption of one exact version of the generated API-client package;
- the medical-web Docker image and the rebuilt Caddy edge image;
- production web and Caddy Compose configuration;
- the single public Caddy instance, TLS, ports 80/443, and edge routing;
- the external `professional-services-edge` network bootstrap;
- web deployment, cross-repository routing smoke tests, and web rollback.

It must not contain Spring Boot source, database migrations, backend business rules, canonical API definitions (OpenAPI), API-client generation or publication, PostgreSQL administration, API deployment, or database backup workflows.

## Commands

Toolchain: Node 24.19.0 and npm 11.17.0 (pinned in `.nvmrc` and `package.json`), Docker Engine with Linux containers and Compose 2.24.4+, GNU Make. Installing requires read access to the private `@dadzhioski` GitHub Packages scope, configured in user-level npm config (see `README.md`); never in the repository. Never claim a command works if its task is not implemented yet; check the task's **Status** and `docs/backlog/milestone-0.md`.

**Install and check** (no API or Docker needed)

- Install: `npm ci`
- Lint (warnings fail): `npm run lint`
- Type check: `npm run typecheck`
- Unit tests: `npm test -- --run`
- Single test file: `npx vitest run <path>`
- Production build: `npm run build`
- API-client version policy: `npm run check:api-client-version`
- Policy and security-gate tests: `npm run test:policy`

`typecheck` and `build` need valid configuration but no running API; `API_INTERNAL_URL=http://127.0.0.1:9` and `PUBLIC_ORIGIN=http://localhost:3000` are enough. Unit tests use synthetic configuration and mocked transport.

**Browser tests** (ports 4310 and 4311 must be free)

- First time only: `npx --no-install playwright install chromium`
- `npm run e2e`

**Run the web locally** (listens on port 3000)

- First time only: copy `.env.example` to an ignored `.env.local` and set `API_INTERNAL_URL` to the API origin (for example `http://localhost:8080`, without `/api/v1`). Do not overwrite existing local configuration.
- Development: `npm run dev`
- Production mode: `npm run build`, then `npm run start` (serves the last build; rebuild after source changes).
- Health: `GET /healthz` (expect 200 and `{"status":"ok"}`, independent of the API)
- API status page: `/system-status`

**Security gates**

- Secrets and dependencies: `make security-check`
- Dependency gate only: `npm run security:dependencies` (applies the owner-approved temporary exception; raw `npm audit` still fails)

**Images and edge integration** (Docker required; details in `docs/ci-and-images.md` and `deployment/README.md`)

- Web image: `make image`, then `make image-smoke-test`, then `make container-scan`
- Edge image: `make edge-image`, then `make edge-container-scan`
- Validate production config: `make validate-production-config`
- Isolated edge stack: `make integration-up`, `make integration-routing-test`, `make integration-api-unavailable-test`, `make integration-restart-test`, `make integration-browser-test`, then always `make integration-down` (also after failures)
- All-in-one (without browser checks): `make integration-test`
- Real API compatibility (needs an independently running non-production API): `make integration-compatibility-test`

**Windows only**

- Every Make target delegates to a Node script in `scripts/`; if Make is unavailable, run the Node command listed in `Makefile` directly.

**Configuration**

- Server configuration is validated at startup; `PUBLIC_ORIGIN` (HTTPS, except explicit loopback HTTP) and `API_INTERNAL_URL` (absolute HTTP(S) origin, no credentials, path, query, or fragment). `NODE_ENV` comes from Next.js/Vitest.
- `.env.local` / `.env` hold local settings only. Never commit them.
- `.env.production.example` contains synthetic values only. Real production values live outside Git.

## Frontend rules

- Follow the structure in `build-plan.md`: routes in `src/app`, features in `src/features/<feature>`, shared UI in `src/components`, and API, config, i18n, and SEO helpers in `src/lib`.
- Pages and layouts are Server Components. Public pages are server-rendered and must work without client-side JavaScript. Introduce Client Components only for real interaction.
- API access goes only through server-only wrappers in `src/lib/api` around the generated client. The browser never calls the API origin directly.
- Server configuration and API wrappers import `server-only`. Never spread `process.env`, pass server config as client props, put it in Next.js `env` config, or add `NEXT_PUBLIC_*` values without approval.
- Business decisions and authorization remain in the API. The web only presents and validates input for usability.
- Raw API failures and internal URLs are never rendered or logged. Every failure mode renders a safe, translated unavailable state.
- User-visible text and metadata use typed translation keys in `src/lib/i18n`.
- Use semantic, accessible HTML: landmarks, skip link, visible focus, labelled controls. Styling uses Tailwind and the small source-owned component set.
- Do not add a global state library or second UI framework without approval.

### Data scope

The product is not an electronic health record.

- Allowed: profile content, credentials, services, locations, appointment type, scheduling preferences, and minimal contact details needed for an appointment request.
- Not allowed: forms, fields, or copy that solicit diagnoses, clinical notes, medications, test results, prescriptions, referrals, patient files, detailed symptoms, or any other detailed medical data.

If a task seems to require collecting or displaying detailed medical data, stop and ask.

## API contract and client rules

- The client package is `@dadzhioski/professional-services-api-client`. Pin one exact version (no `^`, `~`, wildcard, or `latest`) and commit `package.json` and `package-lock.json` together.
- Client code is generated and published by the API repository. Never copy generated source, use local tarballs, or hand-write DTOs or fields that mirror the API.
- If the pinned client lacks required behavior, stop and request a linked API task. Do not work around it.
- Upgrade the client only as described in "Explicit client upgrades" in `README.md`, and only to an approved published version.
- Additive API changes are deployed before the dependent web release.
- Caddy routes `/api/*` to `api:8080` and everything else to `web:3000` on the external network `professional-services-edge`. Do not change aliases, ports, or the network name without asking.

## Security

- Never commit secrets, tokens, or credentials. Registry tokens live in user-level npm config or BuildKit secrets, never in source, build arguments, logs, or chat.
- Never log PII, tokens, cookies, query strings, or credentials. Do not enable Caddy debug or request-body logging.
- No analytics, cookies, external fonts, or third-party scripts without approval.
- Changes to environment boundaries, Caddy routing, forwarded-header trust, security headers, TLS/HSTS, or public port bindings always get tests and human review.
- Production images use immutable full 40-character commit-SHA tags; `latest` and other mutable tags are forbidden.

## Boundaries

**Always**
- Keep public pages server-rendered and accessible.
- Use translation keys for user-visible text.
- Run `npm run check:api-client-version` after any dependency change.
- Run `make integration-down` after any integration run, including failed ones.

**Ask first**
- New dependencies or API-client upgrades.
- New `NEXT_PUBLIC_*` variables or runtime secrets.
- Changes to Caddy routing, TLS, security headers, port bindings, or the edge network.
- Changes to CI permissions, image publishing, or the dependency-audit exception.
- Anything that touches production configuration, deployment, or rollback.

**Never**
- Hand-write or copy TypeScript DTOs that mirror API DTOs.
- Use a floating API-client version or `latest` image tag.
- Run `docker compose down --volumes` on the production project or remove the host edge network.
- Restart, migrate, or otherwise operate the API or PostgreSQL from this repository.
- Run a real production deployment without protected human approval.
- Add Spring Boot code, migrations, OpenAPI definitions, or API deployment workflows to this repository.

## Testing policy

- Always test: configuration validation, server/client environment boundaries, API-wrapper success and failure handling, server-rendered output of new pages, accessibility of new UI, and policy/security scripts.
- Do not write unit tests for: Dockerfiles, Compose files, CI/CD workflow configuration, and pure wiring. Edge routing is covered by the existing `make integration-*` harness; extend it only when the task changes routing or edge behavior.
- Unit tests use synthetic configuration and mocked transport; never require a running API. Browser tests use the isolated Playwright fixture.
- Prefer existing test conventions in the repository over introducing new ones.

## Scripts

- Avoid new complex scripts. "Complex" means longer than about 20 lines or containing non-trivial branching.
- Prefer npm scripts, Make targets, and Compose configuration. Extend the existing `scripts/*.mjs` harness instead of adding parallel tooling.
- Scripts are Node (`.mjs`), not shell, so they run on Windows. Policy logic has tests in `scripts/*.test.mjs`.

## Definition of done

A task is done only when:

- lint, type check, unit tests, production build, and affected Playwright tests pass;
- the API-client version policy passes and the pinned version is unchanged unless the task requires an upgrade;
- public pages remain server-rendered and accessible;
- user-visible text uses translation keys;
- no secrets, PII, or detailed medical data collection are introduced;
- edge integration checks pass if deployment, image, or Caddy files changed;
- the verification steps below are provided.

## Verification steps (required in every final response)

Every final response includes a **Verify** block with:

1. **Local:** the exact steps to test the result on my machine (commands to run, pages to open, behavior to observe).
2. **Non-production VPS:** the exact steps to deploy to and test in the non-production environment (workflow to trigger, what to check).

If a step is not applicable to the task, say so in one line.

### Reference for writing the steps

Local baseline: in the API repository run `make compose-up` and `make run`; here run `npm run dev` and open `http://localhost:3000/system-status` (expect the API service, version, and status). Stop the API and refresh (expect the safe unavailable message). `GET http://localhost:3000/healthz` returns 200 and `{"status":"ok"}` in both cases.

Local edge baseline (Docker): `make image`, `make edge-image`, `make integration-up`, `make integration-routing-test`, then `make integration-down`.

Non-production access (deployment setup in `deployment/README.md`):

- Deployment and rollback are implemented in WEB-M0-006; real VPS proof remains WEB-M0-008. Non-production uses manual dispatch without a separate approver (owner-authorized 2026-10-16); production requires protected human approval. Follow `deployment/README.md` and report unexecuted VPS checks.
- Compose project: `professional-services-medical-web`. Containers: `professional-services-medical-web-web-1` and `professional-services-medical-web-caddy-1`.
- Only Caddy publishes ports (80/443). Check through the non-production site address: `/healthz` (expect 200), `/system-status` (expect server-rendered status), and `/api/v1/system/status` (expect the API response through Caddy).
- Production configuration lives outside Git on the VPS; never write its values into files or responses.
- Logs: `ssh USER@VPS "docker logs --follow --tail 200 --timestamps <container>"`

Mention only the parts relevant to the task (for example, skip the edge checks if the task touches only page content).

## Reporting style (maintainer preference)

Final responses:

- Maximum 5 sentences, excluding the Verify block.
- The Verify block is kept short: numbered steps, no explanation of obvious details.
- No handoff section.
- No summary section.
- No "Next steps" section unless action from me is required.
- Do not list every modified file.
- Do not explain obvious implementation details.
- Report tests only as: "Tests: passed" or "Tests: failed — <reason>".
- State in one line each, only when affected: API-client version, SSR impact, accessibility impact, privacy impact.
- Always report blockers, risks, unexecuted checks, and any deviation from the task file, even if it exceeds the sentence limit.

During execution:

- Avoid unnecessary progress commentary.
- Do not create task reports, summaries, verification logs, or other documentation about the completed work unless explicitly requested. This does not apply to documentation the repository requires: ADRs, `README.md`, `deployment/README.md`, or `docs/ci-and-images.md` updates called for by the task.

## Git conventions

- Branch naming: `WEB-M<phase_number>-<task_number>`.
- Commit messages: `WEB-M<phase_number>-<task_number>: <summarising comment>`.
- Do not push, open pull requests, or merge unless the task says to.
