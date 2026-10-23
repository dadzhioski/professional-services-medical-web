# WEB-M1-008: Add profile-photo and private professional-evidence UI

- **Status:** BLOCKED — awaiting adoption of published client 0.4.0 (API-M1-007 media) via WEB-M1-004; installed client 0.3.0 has no media methods
- **Scope amendment (owner, 2026-10-23):** photo only. Private-evidence UI and the `/[locale]/provider/credentials` route move to [WEB-M1-009](WEB-M1-009-provider-credentials.md); evidence requirements and criteria below apply there. The WEB-ADR-0006 media boundary is owner-accepted.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-005; WEB-M1-004 media capability; WEB-M1-001 media boundary decision
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
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

- [ ] Valid, oversized, invalid-content, interrupted and rejected uploads plus replace/remove scenarios pass.
- [ ] Foreign evidence and anonymous evidence access are denied; private responses and image URLs cannot leak through public previews or caches.
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

