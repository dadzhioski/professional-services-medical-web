# WEB-M1-012: Verify the Milestone 1 provider-to-public journey

- **Status:** IMPLEMENTED — synthetic fixture acceptance and local gates passed (2026-10-27); real API, Google, media, non-production VPS checks, API-owner administrator reconciliation and owner review not executed. The earlier capability block is resolved by pinned client 0.7.0 (see evidence below).
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-003 through WEB-M1-011 implemented; WEB-M1-001 decisions resolved
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-012](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-012-milestone-acceptance.md)
- **Risk:** High

## Goal

Establish evidence for the implemented Milestone 1 journey without closing deferred Milestone 0 obligations.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Exercise mk/en/bg/sq, default redirects, unsupported locales, language navigation and JavaScript-disabled public SSR. Verify API administrator policy reconciliation with the approved MVP-wide MFA deferral while retaining privilege/isolation checks. Include origin spoofing resistance, CSRF/cookie isolation and photo revocation after prior reads; distinguish live checks from fixtures.

## Requirements

1. Extend the existing Playwright fixture with synthetic providers and an administrator to verify onboarding, drafts, services/locations/photo, credential submission/review, doctor approval, explicit publication and anonymous profile reading.
2. Cover cross-user isolation, expired sessions, CSRF failures, rejected uploads, stale edits/reviews, API outage, unpublish and suspension. Verify that private evidence never appears publicly and anonymous pages work with JavaScript disabled.
3. Run the current quality, policy and security gates; record exact web/client/API versions and distinguish fixture results from real-provider and compatible-API results.
4. Perform separately authorized non-production feature validation with the compatible API already deployed, including Google login/logout and actual media delivery when configured. Record unavailable checks as unexecuted.
5. Retain Milestone 0 deferred acceptance separately; no second-release rollback proof, historical hosted evidence reconstruction, documentation reconciliation or clean-room M0 closure is a prerequisite for unrelated feature implementation.
6. Do not extend the dependency exception expiring 2026-10-26 at 00:00 UTC. A failing gate blocks the affected validation/release; production deployment, API operations and new dependencies remain separately authorized.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
9. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [x] The feature journey and security/accessibility failure cases pass with synthetic fixtures.
- [x] Real API/provider/VPS checks are individually evidenced or marked unexecuted; no milestone completion claim hides pending feature acceptance.
- [ ] Owner review identifies remaining feature risks without certifying Milestone 0 closure or authorizing production.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

## Evidence (2026-10-27)

**Versions:** web base commit `927c3e73ceb5a7e8f30c3360a5e6679ff4b78229` plus the WEB-M1-012 journey spec; `@dadzhioski/professional-services-api-client@0.7.0` (exact pin); Node 24.19.0, npm 11.17.0, Playwright 1.64.0. API: the synthetic fixture only (`tests/e2e/api-fixture.mjs`, reporting `synthetic-api 0.2.0`); no real API was contacted.

**Client capabilities (requirement 9):** the installed 0.7.0 declarations contain every method the journey uses: OrganizationApi, ProfileApi (including photo attach/detach and publish/unpublish), MedicalApi, ServicesApi, LocationsApi, ReferenceApi, MediaApi (owner, administrator and public content), CredentialsApi, CredentialReviewApi, DoctorReviewApi (approve/reject/suspend/reinstate) and PublicApi (profile and directory).

**Synthetic fixture results:**
- `tests/e2e/journey.spec.ts`, on Chromium and mobile Chromium, uses only the web UI plus the operator administrator grant:
  - the end-to-end provider-to-public journey, from onboarding through publication, anonymous reading in all four locales without JavaScript, the directory filters, and suspension/reinstatement/republish/unpublish revocation after earlier reads;
  - the failure cases: cross-account isolation, the expired session, the CSRF refusal, the stale publication, the refused upload, and the outage on the public and provider pages;
  - keyboard, 320 px and axe checks on the published end state.
- Feature specs relied on and not duplicated: locale defaults and unsupported locales (`presentation.spec.tsx`); Origin-required mutations (`identity.spec.ts`, `onboarding.spec.ts`, `profile.spec.ts`, `media.spec.ts`); spoofed-host canonicals and cookie non-forwarding (`public-profile.spec.ts`, `public-directory.spec.ts`); stale edits and reviews (`profile`, `services`, `locations`, `credentials`, `admin-review`); rejected uploads and photo revocation (`media.spec.ts`).

**Gates:** all passed.
- `npm run typecheck`, `npm test -- --run`, `npm run build`, `check:api-client-version`, `test:policy`, `security:dependencies` (0 findings, 0 accepted), `security:secrets`, `git diff --check` and the full `npm run e2e` (270 passed).
- Lint: `npx eslint . --ignore-pattern ".claude/**" --max-warnings=0` passed. Plain `npm run lint` failed only on build output inside an untracked local `.claude/worktrees/` agent checkout, not on repository sources. The ESLint config was not changed.
- The dependency exception dated 2026-10-26 has expired and was not extended. The gate no longer needs it, because `eslint-config-next` 16.4.3 has no findings.

**Unexecuted:**
- real API compatibility (`make integration-compatibility-test`);
- Google login/logout;
- R2/actual media delivery;
- non-production VPS deployment and route checks;
- API-owner reconciliation of administrator policy with the MFA deferral (the WEB-ADR-0006 administrator boundary is still pending);
- human boundary review and owner feature review.

Milestone 0 deferred acceptance remains open; nothing here passes or waives it.

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

Also run `npm run security:dependencies` and `npm run security:secrets`; do not treat expired exceptions or unavailable scanners as passing.

**Local:** Use the isolated browser fixture for the acceptance scenarios above; no running API or real personal data is needed. For live manual checks, start `npm run dev` in a fresh terminal with existing local API configuration, then open the task's route recorded in WEB-M1-001 and repeat its success/failure scenarios.

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, using the published full commit-SHA release and the workflow's required configuration/API inputs. Open this task's approved routes on the site origin and repeat the acceptance scenarios with synthetic accounts/content; check `/healthz` and `/system-status` for regressions. Record the exact release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

