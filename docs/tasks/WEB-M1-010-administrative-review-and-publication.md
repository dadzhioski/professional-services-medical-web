# WEB-M1-010: Add administrator review and provider publication controls

- **Status:** BLOCKED — required feature API capabilities are absent from the currently installed client; see linked API tasks
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-007, WEB-M1-009; WEB-M1-004 review/publication capabilities; resolved WEB-M1-001 administrator policy
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; decisions recorded by WEB-M1-001 where applicable
- **Cross-repository dependency:** [API-M1-004](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-004-organizations-and-authorization.md), [API-M1-008](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-008-credential-review.md), [API-M1-009](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-009-approval-and-publication.md)
- **Risk:** High

## Goal

Expose API-authorized review decisions and explicit provider publication controls.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## Requirements

1. Do not begin administrator implementation until the Google/MFA policy conflict is resolved in the API tasks and published authorization contract; no frontend role/MFA workaround.
2. Provide private administrator review of doctor applications and credential revisions, including authorized evidence access, approve/reject and suspension/reinstatement controls supported by the contract.
3. Require explicit confirmation of consequential decisions and submit the reviewed revision. On conflict refresh for renewed review rather than automatically resubmitting a decision.
4. Keep doctor approval, credential approval and profile publication visibly separate; provider controls publish/unpublish and display API eligibility/required corrections.
5. Refresh after edits/decisions to show loss of completeness, suspension and revoked mutation permissions. Reinstatement must not imply automatic republication.
6. Do not bootstrap administrators, grant roles, expose audit/evidence publicly or reimplement backend transition rules.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
9. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [ ] Unauthorized and expired sessions, denied administrator access, stale decisions, rejection/resubmission and suspension/reinstatement are covered.
- [ ] Eligible publication, denied publication, explicit unpublish and completeness-loss states match API responses; controls never replace API enforcement.
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

