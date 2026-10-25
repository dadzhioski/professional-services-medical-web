# WEB-M1-008: Add profile-photo and private professional-evidence UI

- **Status:** IMPLEMENTED LOCALLY (2026-10-25) against pinned client 0.7.0, with a scoped Caddy upload route; human review of the edge change, explicit 0.7.0 approval record, live API/R2 and non-production checks pending. 0.6.0 was never published; on the owner's direction the client moved 0.4.0 → 0.7.0, which contains API-M1-013 (photo attach/detach, `photoMediaId`) and API-M1-008 (credentials with `evidenceMediaIds`) plus PublicApi and review APIs that this task does not use. The owner accepted the WEB-ADR-0006 media boundary on 2026-10-25; administrator evidence access remains pending.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-005; WEB-M1-004 media capability; WEB-M1-001 media boundary decision
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (media boundary accepted 2026-10-25; administrator boundary pending)
- **Cross-repository dependency:** [API-M1-007](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-007-media-and-private-evidence.md)
- **Risk:** High

## Goal

Let providers manage profile photos and private credential evidence with distinct visibility.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Place photo controls in /[locale]/provider/profile and evidence controls in /[locale]/provider/credentials. Use approved same-origin publication-aware API delivery with no-store, no optimized derivatives and no public object URLs after ADR review and media-contract readiness. Test revoked photo denial after prior reads and unsafe delivery URLs. MVP-wide MFA deferral is owner-approved, but administrator evidence access waits for API-owner reconciliation of API-M1-007 and related administrator policy.

## Requirements

1. Use generated media methods and approved same-origin delivery; keep object keys, storage credentials and private upstream locations out of public output.
2. Accept only contract-supported JPEG/PNG with documented byte/dimension limits; client hints improve usability but API validation remains authoritative. No PDF, patient documents or arbitrary files.
3. Keep evidence private and separate from optional profile photos. Provider evidence is accessible only through the authorized private flow; administrator evidence use waits for the resolved administrator policy.
4. Cover upload, replacement, deletion and validation progress with accessible controls and safe messages; handle rejected/interrupted uploads without silently attaching an invalid object.
5. Use synthetic images in fixtures. Do not add R2 credentials, persistent web disk storage, external scripts or image optimization/shared caching that bypasses revocation.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [x] Valid, oversized, invalid-content, interrupted and rejected uploads plus replace/remove scenarios pass.
- [x] Foreign evidence and anonymous evidence access are denied; private responses and image URLs cannot leak through public previews or caches.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Implementation record (2026-10-25):
- Photo controls are on `/[locale]/provider/profile`. Evidence add/remove for existing credentials is on `/[locale]/provider/credentials`; creating, editing and submitting credentials stays in WEB-M1-009.
- Owner previews are plain `<img>` elements pointing at the API's same-origin owner route `/api/v1/media/{uuid}/content` through the existing Caddy `/api/*` route, with `no-referrer` set. There is no web proxy, no `next/image` and no object URLs, and only UUIDs become paths.
- Upload and attach run under one CSRF bootstrap. A failed attach or update deletes the new upload as a best effort. Evidence removal leaves deletion to the API, as the contract specifies.
- `next.config.ts` raises `serverActions.bodySizeLimit` to 11 MB, which applies to every Server Action.

Local evidence (2026-10-25): Node/npm from the repository toolchain. Passed: lint on `src tests scripts next.config.ts` (`npm run lint` also scans the untracked `.claude/worktrees` build output, which is not part of this change), typecheck, 427 unit tests, production build, API-client policy (0.7.0), 39 policy tests, 130 desktop/mobile browser scenarios (16 of them in `media.spec.ts`), and `git diff --check`.

Known gaps and open decisions:
- Files over 11 MB, or errors thrown inside an action, show Next's default untranslated error page; there is no app error boundary. The browser hint blocks files over 10 MiB when JavaScript is on.
- Adding or removing evidence on an APPROVED or SUBMITTED credential returns it to DRAFT with a single click. The only warning is the page-level notice.
- Outcome notices do not name the credential and do not move focus.
- Changing the photo with JavaScript on discards unsaved text in the profile editor.
- Not executed: live API, real R2, Google sign-in and non-production VPS checks.
- Dependency gate (2026-10-25): new advisories against the existing pins (`next` 16.4.0 critical and high; `undici` 8.11.2 and `zod` 4.6.5 high, both dev-only) failed CI on this branch and on `main`. Fixed here with patch upgrades: `next` and `eslint-config-next` 16.4.0 → 16.4.3, `undici` → 8.12.3 and `zod` → 4.6.7 in the lockfile. `npm audit` reports 0 vulnerabilities, and the gate passes with 0 accepted exceptions.
- Edge container scan (2026-10-25): the pinned `caddy:2.11.7-alpine` base (Alpine 3.23.6), and also the newest rebuild of that tag, ships `brotli-libs` 1.2.0-r0 (CVE-2026-111497, HIGH), which failed `make edge-container-scan` in CI. `deployment/Dockerfile.caddy` now runs `apk upgrade --no-cache brotli-libs` (to 1.2.1-r0) in the final stage until upstream rebuilds the base. Only `curl` uses that library, and the Caddy health check uses busybox `wget`. Locally the rebuilt edge image scans with 0 HIGH/CRITICAL findings, and the full integration sequence passes with it.

## Edge change for uploads (implemented locally 2026-10-25; awaiting human review, not deployed)

The owner chose to raise the edge timeout for uploads rather than shorten them. AGENTS.md requires tests and human review for Caddy routing changes, and WEB-ADR-0004 (amended, proposed) owns the edge.

**Problem.** Caddy's web route allowed 10 s, but one upload action makes up to five sequential API calls:
- CSRF token
- credential read (evidence only)
- upload
- attach or update
- delete of the new upload, only when attaching fails

Before this change each call was allowed 30 s. A slow upload could return an empty 504 from the edge while the change still completed.

**Web: one time budget per upload action** (`src/lib/api/session-transport.ts`, `src/lib/api/media.ts`).
- Calls default to 5 s each; the upload call has 25 s.
- `csrfMutation` takes a total budget, 40 s for uploads, combined with each call's own signal.
- When the budget runs out, the action returns the translated `unavailable` notice. A failed attach still attempts the best-effort delete; if the budget has already expired, the API's 24-hour cleanup removes the upload.

**Edge: a separate Caddy route for upload pages** (`deployment/Caddyfile`).
- `@web_upload` matches `POST` to `/{mk,en,bg,sq}/provider/profile` and `/{mk,en,bg,sq}/provider/credentials`.
- It proxies to `web:3000` with `dial_timeout 2s`, `response_header_timeout 50s`, `read_timeout 50s`, `write_timeout 30s` and `request_body max_size 12MB`, logged as route `web-upload`.
- `read_timeout` must match the header timeout because Caddy applies the read deadline while waiting for headers too. The first integration run proved this: with `read_timeout 10s` a 20 s upload returned 504 after about 9.5 s.
- All other web requests keep the 10 s timeouts and gain `request_body max_size 1MB`.
- The `/api/*` route, security headers, error handling, logging and forwarded-header trust are unchanged.

**What the body limits guarantee.** Caddy cuts a request body off at the route limit, so the web never receives more than 12 MB on the upload route or 1 MB elsewhere. Whether the client then gets 413 from the edge depends on whether the web was still reading the body. A real oversized upload and oversized posts to other pages got 413. A raw 13 MB POST that the web did not read got the web's normal 200, still with only 12 MB forwarded. Caddy cannot reject on `Content-Length` up front: Go moves that header out of the header map, so neither `header_regexp` nor `expression` matchers can see it. Both were probed against the real edge image.

**Checks added.**
- `scripts/production-config.mjs`: `edgeProxies` and `validateEdgeLimits` check the adapted Caddy JSON. Exactly three proxies are allowed:
  - the API proxy at 6 s;
  - the upload proxy, whose paths must equal the locale registry × upload pages, at 50 s, 12 MB, with the web budget ending at least 5 s earlier;
  - the web proxy at 10 s and 1 MB.

  Site `host` matchers are ignored. A policy test covers drift cases: a missing or extra page, a new locale, a short timeout, a budget that is too long, and a raised web cap.
- `make validate-production-config` runs `caddy adapt` for both the smoke and production site forms. It derives the locales from `src/lib/i18n/index.ts`, the upload pages from pages that render the image input, and the budget from `src/lib/api/media.ts`.
- `tests/integration/api-fixture.mjs` adds a minimal synthetic provider session (account, context, CSRF, profile, upload, photo attach, delete, owner content) with `media-fast`/`media-slow` (20 s)/`media-stall` control modes on loopback.
- New `make integration-upload-test` (`scripts/integration.mjs uploads`, also part of `make integration-test`):
  - a fast upload, with owner image delivery through `/api/*` (200, `no-store`; 401 without a session);
  - a 20 s upload succeeds (about 20 s);
  - a stalled upload ends with the web's `?photo=unavailable` before the edge limit (about 25 s);
  - a 10 MiB image is accepted;
  - an oversized upload never succeeds, and Caddy forwards at most 12 MB, or 1 MB on other pages (checked from its access log `bytes_read`);
  - a 10 MiB upload streamed at about 1 MiB/s succeeds;
  - log privacy still holds.
- `tests/integration/browser/edge.spec.ts`: a photo upload without JavaScript through real Caddy, desktop and mobile.
- Docs: `deployment/README.md` (routing bullets and step list) and the WEB-ADR-0004 amendment.

**Edge evidence (2026-10-25, local Docker 29.8.2).**
- Images used:
  - web: `professional-services-medical-web:deadbeefdeadbeefdeadbeefdeadbeefdeadbeef`, a synthetic local tag built from the uncommitted working tree with the same arguments as `make image`, so no commit's tag was reused;
  - edge: the existing `professional-services-medical-edge:aec5d8d0…`. The Caddyfile is bind-mounted from the working tree, so the image needs no rebuild.
- Passed: validate, up, routing, API-unavailable, uploads, browser (10 tests), restart, and down (owned resources removed).
- Not run: `make edge-image`, `make edge-container-scan`, and CI.

**Open for the reviewer.**
- `.github/workflows/ci.yml` and the AGENTS.md command list name each integration step separately, so neither runs `integration-upload-test` yet. This task's non-goals exclude CI changes; adding that line is a reviewer decision.
- An upload can now hold a web request for up to 50 s. The web container (512 MiB/1 CPU) has not been load-tested with concurrent large uploads; measure that in non-production.
- The upload matcher lists pages by name. `validate-production-config` fails when a locale or upload page is added without updating it.
- No deployment happened. Non-production needs separate authorization; production needs protected approval.

## Verification

Use the repository's pinned toolchain and existing installed dependencies; run `npm ci` if installation is needed. For build/type generation, use an existing valid configuration or this synthetic origin (no API process is required):

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run test:policy
npm run e2e
git diff --check
```

**Local:** Use the isolated browser fixture for the acceptance scenarios above; no running API or real personal data is needed. For live manual checks, start `npm run dev` in a fresh terminal with existing local API configuration, then open the task's route recorded in WEB-M1-001 and repeat its success/failure scenarios.

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, using the published full commit-SHA release and the workflow's required configuration/API inputs. Open this task's approved routes on the site origin and repeat the acceptance scenarios with synthetic accounts/content; check `/healthz` and `/system-status` for regressions. Record the exact release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

