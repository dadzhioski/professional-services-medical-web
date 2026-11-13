# WEB-M1-007: Add services, specialties and practice-location editors

- **Status:** IMPLEMENTED LOCALLY (2026-10-22) against pinned client 0.3.0 (`ServicesApi`, `LocationsApi`, `ReferenceApi`, `MedicalApi`); human boundary review, live API and non-production checks pending; API contract amendment requested (see below)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-006; WEB-M1-004 catalog/reference capability
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-006](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-006-services-and-locations.md)
- **Risk:** Medium

## Goal

Let providers manage the services and locations shown on their profile.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Use /[locale]/provider/services and /[locale]/provider/locations with four-locale interface messages. API reference and provider-authored content remain contract-supplied; do not invent translated reference DTOs.

## Requirements

1. Use generated CRUD and reference methods for services, practice locations and specialties; store the API's stable reference IDs rather than inventing labels as identity.
2. Preserve absent versus zero service price and contract currency/decimal semantics; do not use lossy arithmetic to transform monetary values.
3. Provide accessible add/edit/remove and association controls, with explicit confirmation for removal and translated empty/error states.
4. Collect only intended public practice addresses, not separate home addresses; no maps, geocoding, availability calendar or booking.
5. Refresh API state after edits and show any returned publication/completeness change; never recompute authorization or publication eligibility as authoritative frontend rules.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Scope decisions and contract notes (2026-10-22)

Owner decisions: the specialty selector is a single dropdown on `/[locale]/provider/profile` (licence number and registration body stay in WEB-M1-009). Reference labels exist only for `mk`, `en` and `bg`, so Albanian (`sq`) pages show the stable reference `code`.

Observed 0.3.0 behaviour: services and locations are replaced in full on `PUT` with `version`; a stale version returns 409; 400 responses (invalid input, unknown or foreign references, limits) carry no field codes; deleting a location unlinks it from services. `Price.amount` is a decimal string (`EUR`/`MKD`); the web never converts it to a number, keeps "no price" distinct from `0`, and formats it with `Intl` from the string. `editMedicalProfile` replaces licence number, registration body and specialty together, so the web re-reads the first two on the server and sends them unchanged. Service, location and medical responses carry no publication state; after each change the page re-reads the profile and shows the API-reported `publicationState`. Owner endpoints are called only after current context confirms a workspace. The CSRF header gap recorded in WEB-M1-005 also applies.

Requested amendment to [API-M1-006](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-006-services-and-locations.md):

- document field-level validation codes (including foreign-location and limit failures);
- add `sq` reference labels, or document the intended fallback;
- return the resulting publication/completeness state from service, location and medical mutations, or document that clients must re-read the profile.

The API repository is not modified by this task.

## Acceptance criteria

- [x] CRUD, invalid/unknown references, absent/zero prices, failed deletion and foreign association rejection are covered (synthetic unit and browser fixture; live API not exercised).
- [x] Keyboard/mobile editing works and API-reported unpublication is reflected without claiming success after failure (synthetic browser fixture).
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; live API, human boundary review and non-production checks remain pending. `npm run lint` over `.` also scans an untracked local `.claude/worktrees/` directory; `eslint src tests scripts` passes.
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

