# WEB-M1-009: Add structured credential editing and submission

- **Status:** IMPLEMENTED LOCALLY (2026-10-26) against pinned client 0.7.0, which contains the API-M1-008 owner credential lifecycle (create/get/list/update/delete/submit, `state`, `revision`, `version`, `rejectionReason`), so the earlier capability block is resolved. Live API and non-production checks pending.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-006, WEB-M1-008; WEB-M1-004 credential capability
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-008](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-008-credential-review.md)
- **Risk:** High

## Goal

Let providers submit professional qualifications and understand their review state.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Use /[locale]/provider/credentials with four-locale interface messages and provider-authored qualification content as supplied. Submission/status presentation is distinct from administrator review, whose policy reconciliation remains a separate gate.

## Requirements

1. Consume generated credential fields, lifecycle and revision types; provide structured qualification inputs and attachments only to validated evidence belonging to the current provider.
2. Display draft/submitted/approved/rejected states and owner-visible safe feedback; support correction and resubmission.
3. Handle stale revisions and failed submissions explicitly, keeping user input available without claiming approval.
4. Reflect the API's changed-credential eligibility and publication effects; the browser never grants approval or maintains a shadow workflow.
5. Keep reviewer identity, private feedback and evidence out of public components and metadata; no clinical records or external license-verification service.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [x] Submission, rejection, correction, resubmission, stale revisions and foreign/invalid evidence errors are covered.
- [x] Editing an approved credential refreshes API state; private evidence and feedback never enter anonymous output.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Implementation record (2026-10-26):
- `/[locale]/provider/credentials` now creates, edits, submits and deletes credentials (deletion added on the owner's direction), next to the WEB-M1-008 evidence controls. Removal uses the server-rendered confirmation step. Everything works without JavaScript.
- New credentials are created without evidence; images are then added through the existing evidence upload. A field edit rereads the credential at the shown version and resends the API's current evidence, so the browser never supplies evidence IDs. Stale edits show the latest values with an explicit overwrite choice; stale submissions and deletions are refused with a reload notice.
- States, the owner-visible rejection reason (REJECTED only, plain text) and the API's profile publication status are shown as reported. Editing a SUBMITTED or APPROVED credential warns that it returns to draft. The web computes no eligibility. Submission is offered only for DRAFT/REJECTED credentials with evidence; the API remains authoritative (422 and 409 are mapped).
- Title/issuer bounds (200) and the 20-credential limit come from the published contract. Expiry before issue is checked for usability; the future-issue-date rule is left to the API.
- The browser fixture adds credential create, submit and delete, a no-op for identical updates, a simulated administrator decision (`/control/credentials/review`) and the API's completeness unpublish when the last approved credential is lost.

Local evidence (2026-10-26): Passed: lint on `src tests scripts next.config.ts` (`npm run lint` also scans the untracked `.claude/worktrees` build output, as in WEB-M1-008), typecheck, 688 unit tests, production build, API-client policy (0.7.0), 39 policy tests, 192 desktop/mobile browser scenarios (14 in `credentials.spec.ts`) and `git diff --check`. Not executed: live API, Google sign-in and non-production VPS checks.
- Edge container scan (2026-10-26): CI failed on two new HIGH findings in the pinned Caddy base, `curl` and `libcurl` 8.22.0-r0 (CVE-2026-92392). `deployment/Dockerfile.caddy` now also upgrades both packages to 8.23.0-r0, next to the existing `brotli-libs` patch. Locally the rebuilt edge image scans with 0 HIGH/CRITICAL findings, the web image is unchanged at 0, and the full edge integration sequence passes.

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

