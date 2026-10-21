# WEB-M1-006: Add professional profile draft editing

- **Status:** IMPLEMENTED LOCALLY (2026-10-21) against pinned client 0.3.0 (`ProfileApi.getProfile`/`createOrGetProfile`/`editProfile`); human boundary review, live API and non-production checks pending; API contract amendment requested (see below)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-005; WEB-M1-004 profile capability
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-005](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-005-professional-profile-drafts.md)
- **Risk:** Medium

## Goal

Let a provider create and safely edit their private professional profile.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Use /[locale]/provider/profile with four-locale interface dictionaries. Provider-authored biography/contact content remains as supplied; do not invent translated API fields or publish login identity as contact data. Photo controls are supplied by 008.

## Requirements

1. Consume generated profile read/create/update DTOs and methods; support incomplete drafts and the API's version/conflict semantics.
2. Use labelled translated inputs for contract-supported professional fields only; distinguish professional contact data from account login email and identify content intended for later publication.
3. Display the stable API-assigned slug read-only; do not derive identity from display name or implement slug renaming.
4. Map only recognized API validation codes to safe field/form messages; preserve unsaved input on validation/transport failure and offer explicit reload/review on stale edits without silently overwriting.
5. Draft preview stays authenticated and noindex; published display and publication actions belong to 010/011.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Scope decision and contract notes (2026-10-21)

Owner decision: this task edits the vertical-neutral profile only (display name, biography, read-only slug). MedicalApi fields from API-M1-005 move to their related tasks: licence number and registration body to WEB-M1-009, specialty to WEB-M1-007.

Observed 0.3.0 behaviour: `editProfile` replaces both text fields and carries `version` in the body; a stale version returns 409; validation failures return a generic 400 Problem Detail without field codes; the published OpenAPI limits are 255 (display name) and 2000 (biography) characters. The web always sends both fields. It checks the same limits locally for usability and maps any API 400 to one generic form message. A 409 shows the latest saved version for explicit review, with a separate choice to save over it or discard. Profile endpoints are called only after current context confirms a workspace, because they return 500 without one. The CSRF header gap recorded in WEB-M1-005 also applies here.

Requested amendment to [API-M1-005](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-005-professional-profile-drafts.md):

- document field-level validation codes;
- declare `publicationState` as an enum;
- return a documented status instead of 500 for accounts without a workspace;
- add explicitly public professional contact fields if they are intended. Until then, the editor states that contact details cannot be added yet and never shows login identity.

The API repository is not modified by this task.

## Acceptance criteria

- [x] Create/read/save, invalid fields, stale edit, unavailable API and lost authorization are tested (synthetic unit and browser fixture; live API not exercised).
- [x] Drafts never leak through anonymous HTML, metadata, previews or shared caches; keyboard error recovery works (synthetic browser fixture).
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; live API, human boundary review and non-production checks remain pending.
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

