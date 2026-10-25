# WEB-M1-004: Adopt an approved published feature API client

- **Status:** IN PROGRESS — client 0.3.0 adopted locally; non-production compatibility checks pending; API-M1-007 through API-M1-010 capabilities absent
- **Target repository:** `professional-services-medical-web`
- **Depends on:** None; feature-specific API publication and explicit upgrade approval
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; decisions recorded by WEB-M1-001 where applicable
- **Cross-repository dependency:** [API-M1-011](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-011-contract-and-release-readiness.md)
- **Risk:** Medium

## Goal

Make the exact published feature contract available before dependent web integrations.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## Requirements

1. Inspect the approved published package against required methods for API-M1-004 through API-M1-010 and record a capability matrix and exact release provenance here; do not choose a speculative future version.
2. Use README.md Explicit client upgrades, obtain approval for the exact published version, then update package.json and package-lock.json together. No local tarballs, copied generated code or handwritten API DTOs.
3. API-M1-011 prepares a release but does not prove publication; verify registry availability and identify the actual API release supplying each required capability.
4. Preserve system-status and identity behavior. Add or extend adapter tests for changed generated-client behavior using mocked transport.
5. Allow this task to be amended for separately approved incremental published releases; gate each consumer on its actual capabilities rather than unnecessarily waiting for all feature APIs. Deploy additive API behavior before the dependent web release.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Release provenance and capability matrix (2026-10-21)

- Previous pin: `0.2.0` (`sha512-C44VLCqdR1PQDAK6TnpaXPeBUwEd76yoOPDjZdCuQAeUZbK7ez3CmkgZtbUKdQUWbDGmPDFG23aKjcwjuqfAWA==`).
- Adopted (owner-approved): `0.3.0`, registry integrity `sha512-P44HApAF/LicamACKTh85rFsEyeliRMASc3BnskEjYKtcDvkfhfn+3wY8JNDNkR5GOn1z7PEpEO7eCkG4hqFMA==`, matching the lock file. Prepared by API commit `96e1548` ("API-M1-006: prepare client release 0.3.0"; additive over 0.2.0 per oasdiff) and published through the API `release-client.yml` workflow; registry metadata carries no `gitHead`, so the publishing commit is taken from the API release record.
- Published 0.3.0 versus 0.2.0: `SystemApi`, `IdentityApi`, `ActuatorApi`, `runtime`, `SystemStatus`, `CurrentAccount`, `CsrfResponse` and `ProblemDetail` differ only in the OpenAPI version header, so the existing status and identity adapters need no change.
- New models: ContextResponse, OnboardingResponse, ProfileResponse, EditProfileRequest, MedicalProfileResponse, EditMedicalRequest, ServiceResponse, Create/UpdateServiceRequest, Price, PracticeLocationResponse, Create/UpdateLocationRequest, PlaceLabels, CountryResponse, CityResponse, SpecialtyResponse, SpecialtyLabels.

| API task | Generated methods (published 0.3.0) | Web consumer |
|---|---|---|
| API-M1-003 | `IdentityApi`: beginGoogleLogin, completeGoogleLogin, getCsrfToken, getCurrentAccount, logout (unchanged) | Existing identity adapter |
| API-M1-004 | `OrganizationApi`: getCurrentContext, onboard | WEB-M1-005 |
| API-M1-005 | `ProfileApi`: createOrGetProfile, getProfile, editProfile; `MedicalApi`: createOrGetMedicalProfile, getMedicalProfile, editMedicalProfile | WEB-M1-005, WEB-M1-006 |
| API-M1-006 | `ServicesApi` and `LocationsApi` create/get/list/update/delete; `ReferenceApi`: listCountries, listCities, listSpecialties | WEB-M1-007 |
| API-M1-007 | `MediaApi`: uploadMedia, getMedia, getMediaContent, getMediaContentAsAdministrator, getPublicMediaContent, deleteMedia (0.4.0) | WEB-M1-008 |
| API-M1-013 | `ProfileApi`: attachProfilePhoto, detachProfilePhoto; `ProfileResponse.photoMediaId` (0.5.0) | WEB-M1-008 |
| API-M1-008 | `CredentialsApi` create/get/list/update/delete/submit with `evidenceMediaIds`; `CredentialReviewApi` list/get/approve/reject (0.6.0) | WEB-M1-008 (evidence), WEB-M1-009, WEB-M1-010 |
| API-M1-009 | `DoctorReviewApi` list/get/approve/reject/suspend/reinstate; `ProfileApi` getProfilePublication/publish/unpublish; required `ContextResponse.approvalRevision` (0.6.0) | WEB-M1-010 |
| API-M1-010 | `PublicApi`: getPublicProfile, listPublicDoctors (0.7.0) | WEB-M1-011 |

Upgrade record (2026-10-25, WEB-M1-008): pinned `0.7.0`, integrity `sha512-CmfMv4LL3hOIWh9uqHPXf5ykOrsNmVOICHWbnKhWfYNyHCi07Fs1OEN4RDQSPTA8ka2OSq70xeQ/5PU7pUD5uA==`. 0.6.0 was prepared but never reached the registry; the owner directed 0.7.0, which carries the 0.5.0/0.6.0 changes. The only breaking type change for existing code is the required `ContextResponse.approvalRevision`; runtime wrappers do not read it, and synthetic test fixtures were updated.

## Acceptance criteria

- [x] One approved exact version is installed reproducibly and passes the version policy; required exported types/methods are recorded.
- [x] Status and identity regressions pass; absent capabilities remain explicit linked API blockers.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Local evidence (2026-10-21): Node 24.19.0/npm 11.17.0; `npm ci` clean reinstall, lint, typecheck, unit tests, production build, API-client policy (0.3.0), 50 policy tests, 70 desktop/mobile browser scenarios and `git diff --check` passed. Live API compatibility, Google sign-in against a running API and non-production release checks were not executed. Edge integration is not applicable (no edge/deployment configuration changed). Deferred Milestone 0 obligations remain open.

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

**Local:** Use the isolated browser fixture for the acceptance scenarios above; no running API or real personal data is needed. For live manual checks, start `npm run dev` in a fresh terminal with existing local API configuration, then open the task's route recorded in WEB-M1-001 and repeat its success/failure scenarios. This client adoption task also checks `/system-status` and any already implemented identity routes.

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, using the published full commit-SHA release and the workflow's required configuration/API inputs. Open this task's approved routes on the site origin and repeat the acceptance scenarios with synthetic accounts/content; check `/healthz` and `/system-status` for regressions. Record the exact release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

