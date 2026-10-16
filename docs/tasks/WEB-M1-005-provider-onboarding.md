# WEB-M1-005: Add solo-provider onboarding and workspace

- **Status:** BLOCKED — required feature API capabilities are absent from the currently installed client; see linked API tasks
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-002, WEB-M1-003, WEB-M1-004 onboarding capability
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-004](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-004-organizations-and-authorization.md)
- **Risk:** High

## Goal

Let a verified doctor create or resume one solo provider workspace.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Use /[locale]/provider and /[locale]/provider/onboarding with the four-locale foundation from 002. Present the resumable checklist: workspace, profile/services/location/credentials, optional photo, review, then explicit publication when API eligibility permits. Saved progress comes from API state, not a web-owned workflow; administrator policy blocks dependent operations only.

## Requirements

1. Use generated onboarding/current-context methods through authenticated server wrappers; derive workspace context from the API rather than accepting browser role or tenant claims.
2. Present the agreed onboarding steps and existing-account resume path, with accessible pending/error/success states and protected provider navigation.
3. Prevent accidental repeated UI submissions while relying on API idempotency for retries; recover after ambiguous transport failure by refreshing current context.
4. Present API-provided verification, membership and restriction states. Handle 401, 403 and service failure without inventing business permissions.
5. Do not create organizations locally, grant roles, add organization switching or collect patient information.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [ ] First onboarding, retry/resume, existing membership, unverified account, foreign identifiers and expired-session scenarios are covered.
- [ ] A successful response shows the correct private workspace; failure cannot appear as successful onboarding.
- [ ] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [ ] No deferred Milestone 0 obligation is marked passed or waived.

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

