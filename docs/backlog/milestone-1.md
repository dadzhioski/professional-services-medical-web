# Web Milestone 1 — Frontend planning authorization

- **Status:** AUTHORIZED FOR PLANNING AND IMPLEMENTATION (owner decision, 2026-10-16); WEB-M1-001 through WEB-M1-012 created, with feature-specific decisions and API gates below.
- **Direction:** Public doctor profiles and provider onboarding, as described in `build-plan.md`.
- **Starting point:** Implemented Next.js/SSR foundation, exact generated API client, CI/images and owner-confirmed working first non-production deployment.
- **Milestone 0:** Formal acceptance remains open; deferred work is tracked in `milestone-0.md` and does not block unrelated frontend work.

## Task-authoring rules

1. Create scoped `WEB-M1-*.md` tasks using the existing template when requested; this note is not itself an implementation task or a complete feature specification.
2. Do not depend on "Milestone 0 complete", WEB-M0-007, or remaining WEB-M0-006/008 operational proof merely to start frontend work. Reference implemented foundations where useful, explicitly distinguishing available implementation from deferred acceptance.
3. Keep rollback proof, historical hosted evidence, clean-room acceptance, documentation reconciliation and final Milestone 0 sign-off as separate follow-up work, not mandatory acceptance criteria copied into every frontend task.
4. Determine dependencies from the feature itself: design/content decisions, shared components and the actual published API-client capabilities. Inspect the contract before promising data-backed profile, onboarding, provider editing or administrative behavior; do not assume the status endpoint implies those capabilities exist.
5. Separate independent presentation work from API-dependent integration where useful. Synthetic content for explicitly scoped previews/tests is allowed, but must not masquerade as live integration or introduce handwritten API DTOs. Missing API behavior requires a linked API task and blocks only the dependent integration work.
6. Preserve task-level tests, SSR, accessibility, translation keys, privacy constraints, exact client pinning and existing CI/security gates. This authorization does not approve dependency upgrades, new runtime secrets, external scripts, detailed medical-data collection or production deployment.
7. Do not silently extend the dependency-audit exception expiring 2026-10-26 at 00:00 UTC. Track its remediation separately from frontend planning; report any actual failed gate on the work it affects.

## Milestone 1 task backlog (2026-10-16)

Task creation is complete; feature implementation has not started. Use [the task template](../tasks/TASK-TEMPLATE.md) and assign one task at a time. WEB-M1-001 records owner decisions (2026-10-16), with ADR review and API-owner policy reconciliation pending; it does not reopen authorization to begin Milestone 1.

| Task | Outcome | Dependencies |
|---|---|---|
| [WEB-M1-001](../tasks/WEB-M1-001-experience-and-security-decisions.md) | Owner decisions recorded; ADR review/API reconciliation pending | None |
| [WEB-M1-002](../tasks/WEB-M1-002-shared-ui-and-profile-presentation.md) | Build shared UI and a synthetic profile presentation | WEB-M1-001 experience decisions |
| [WEB-M1-003](../tasks/WEB-M1-003-google-sign-in-and-session-boundary.md) | Integrate Google sign-in and secure server sessions | WEB-M1-001 auth decisions; WEB-M1-002 |
| [WEB-M1-004](../tasks/WEB-M1-004-feature-client-adoption.md) | Adopt an approved published feature API client | None; feature-specific API publication and explicit upgrade approval |
| [WEB-M1-005](../tasks/WEB-M1-005-provider-onboarding.md) | Add solo-provider onboarding and workspace | WEB-M1-002, WEB-M1-003, WEB-M1-004 onboarding capability |
| [WEB-M1-006](../tasks/WEB-M1-006-provider-profile-editor.md) | Add professional profile draft editing | WEB-M1-005; WEB-M1-004 profile capability |
| [WEB-M1-007](../tasks/WEB-M1-007-services-and-practice-locations.md) | Add services, specialties and practice-location editors | WEB-M1-006; WEB-M1-004 catalog/reference capability |
| [WEB-M1-008](../tasks/WEB-M1-008-profile-photo-and-private-evidence.md) | Add profile-photo and private professional-evidence UI | WEB-M1-005; WEB-M1-004 media capability; WEB-M1-001 media boundary decision |
| [WEB-M1-009](../tasks/WEB-M1-009-provider-credentials.md) | Add structured credential editing and submission | WEB-M1-006, WEB-M1-008; WEB-M1-004 credential capability |
| [WEB-M1-010](../tasks/WEB-M1-010-administrative-review-and-publication.md) | Add administrator review and provider publication controls | WEB-M1-007, WEB-M1-009; WEB-M1-004 review/publication capabilities; resolved WEB-M1-001 administrator policy |
| [WEB-M1-011](../tasks/WEB-M1-011-public-profile-and-seo.md) | Integrate public server-rendered doctor profiles and SEO | WEB-M1-002; WEB-M1-004 public-profile capability; WEB-M1-001 route/origin decisions |
| [WEB-M1-012](../tasks/WEB-M1-012-milestone-acceptance.md) | Verify the Milestone 1 provider-to-public journey | WEB-M1-003 through WEB-M1-011 implemented; WEB-M1-001 decisions resolved |

### Observed capability and approval gates

- The repository pins `@dadzhioski/professional-services-api-client@0.2.0`. Read-only inspection of the installed package found system/health and IdentityApi login/current-account/CSRF/logout methods, but no profile, onboarding, catalog, media, credential, review or publication methods.
- Installed declarations are capability observations, not fresh registry-publication or deployed-API proof. WEB-M1-003 verifies identity provenance/compatibility before use; WEB-M1-004 requires explicit approval and an actually published exact feature version.
- API-M1-004 through API-M1-010 are planned in the inspected sibling tasks. API-M1-011 prepares the client release but does not publish it. Each dependent web task remains blocked until its actual methods/types and compatible backend behavior are available.
- The owner deferred MFA entirely for this MVP, including administrators (2026-10-16). API-M1-003/004/007/008/009 still require API-owner reconciliation and compatible authorization before administrator integration/evidence access; no local bypass. Stored privileges, controlled bootstrap, tenant isolation and audits remain mandatory.
- [WEB-M1-001](../tasks/WEB-M1-001-experience-and-security-decisions.md#owner-decision-record-2026-10-16) records approved mk-default/en/bg/sq build-time locale configuration, localized routes, neutral medical style, resumable onboarding and professional contact policy. Session-cookie/server-only forwarding, PUBLIC_ORIGIN and no-store publication-aware photo design scope are owner-approved; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) remains Proposed pending review. Only dependent boundary implementation waits for review; synthetic presentation may proceed.
- Cross-repository task links assume the sibling checkout layout `professional-services-platform-api/professional-services-platform-api`, matching the inspected workspace. These files are read-only dependencies; this task creation does not modify the API repository.

### Execution paths

- WEB-M1-001 experience decisions are recorded; proceed with WEB-M1-002 multilingual presentation using synthetic tests/previews; no missing feature DTO is needed for that work.
- WEB-M1-003 can integrate available identity behavior after its decisions and compatibility checks, without waiting for the entire feature client.
- WEB-M1-004 can proceed independently as approved feature releases become available. An incremental release unblocks only the consumers whose capabilities are present.
- Provider editing follows 005 → 006 → 007; media 008 can follow 005 independently of profile/catalog editing. Credentials 009 joins profile and media work; review/publication 010 follows catalog and credentials.
- Public SSR/SEO 011 depends on presentation and the public API contract, not completion of the provider/admin web screens; use synthetic public-response fixtures for tests.
- WEB-M1-012 validates the completed feature journey. Milestone 0 closure and API milestone-wide historical acceptance are not blanket dependencies; actual feature API readiness and existing quality/security gates still apply.

### Scope and milestone acceptance

The default scope follows `build-plan.md`: public doctor profiles, credentials, services, locations, photo, provider onboarding/editing, administrator review and publication. Directory/search is excluded despite API-M1-010 also providing directory endpoints; adding it requires an explicit task amendment. Appointment requests remain Milestone 2, and analytics/pilot readiness remain later work.

- [ ] Applicable product/security decisions reviewed without silently accepting proposed API policy.
- [ ] Provider onboarding, private editing and review/publication journeys implemented against an approved exact client.
- [ ] Public profile HTML, SEO and eligible images reflect current API publication state without leaking private evidence.
- [ ] Accessible responsive UI and JavaScript-disabled public reading verified.
- [ ] Synthetic success/failure, isolation, session, CSRF and stale-revision scenarios pass.
- [ ] Quality/security gates pass for the affected release; no automatic dependency-exception extension.
- [ ] Live API, Google, media and non-production checks are separately evidenced or explicitly unexecuted; pending feature checks prevent an unqualified completion claim.
- [ ] Owner reviews feature acceptance; deferred Milestone 0 obligations remain open.

### Linked API work

- [API-M1-003](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-003-auth0-sessions.md): Google identity and sessions (filename retains the former Auth0 name).
- [API-M1-004](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-004-organizations-and-authorization.md): Solo onboarding and authorization.
- [API-M1-005](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-005-professional-profile-drafts.md): Profile drafts.
- [API-M1-006](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-006-services-and-locations.md): Services, locations and references.
- [API-M1-007](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-007-media-and-private-evidence.md): Photos and private evidence.
- [API-M1-008](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-008-credential-review.md): Credential review.
- [API-M1-009](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-009-approval-and-publication.md): Doctor approval, publication and suspension.
- [API-M1-010](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-010-public-profiles-and-directory.md): Public profiles; directory UI excluded here.
- [API-M1-011](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-011-contract-and-release-readiness.md): Contract and client release preparation.
- [API-M1-012](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-012-milestone-acceptance.md): API feature acceptance coordination.


## Deferred acceptance

See the [Milestone 0 deferred-work register](milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Leave incomplete checks open and distinguish owner-reported deployment success from independently inspected evidence. The owner has already authorized proceeding; no repeat transition approval is required.
