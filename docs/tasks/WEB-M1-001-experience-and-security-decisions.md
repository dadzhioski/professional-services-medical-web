# WEB-M1-001: Resolve Milestone 1 experience and security decisions

- **Status:** Decisions recorded — documentation implemented; ADR review and API-owner policy reconciliation pending (2026-10-16)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** None
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed)
- **Cross-repository dependency:** Read API-M1-003/004/007/008/009 via the links in the milestone backlog; decisions only, no API changes.
- **Risk:** Medium

## Goal

Record the decisions needed to implement public profiles and provider onboarding without inventing product or authorization policy.

## Allowed scope

- Task decisions, a focused WEB ADR and milestone planning updates only.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## Requirements

1. Review build-plan.md and the linked API task requirements; record choices in this task and a focused WEB ADR where a lasting architecture/security decision is needed. New ADRs remain Proposed until reviewed.
2. Follow the owner-approved experience decisions below, superseding the initial unprefixed route and English-only proposals; implement translations in downstream tasks, not this documentation task.
3. Reconcile the owner's MVP-wide MFA deferral below with API-M1-003/004/007/008/009 through the API owner. No web-owned MFA or bypass of existing API enforcement.
4. Specify the same-origin Google navigation, server-only session/CSRF adapter and cookie propagation design before authentication implementation. Obtain explicit approval for required session cookies and environment-boundary changes; no new auth provider, browser API SDK or web-owned OAuth secrets.
5. Decide canonical public origin configuration and publication-aware photo delivery without trusting arbitrary Host headers or permitting stale cached revoked images. Any new configuration or boundary change needs its own reviewed tests.
6. Record scope: profile, credentials, services, locations, photo, provider editing, administrator approval and explicit publication. No directory/search, appointments, analytics, maps, clinic teams or patient accounts in this milestone unless the owner amends scope.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Do not approve decisions on behalf of the owner; unresolved items block only dependent work.
9. Inspect the relevant installed client and linked API tasks; contract gaps remain linked blockers, never invented DTOs.

## Owner decision record (2026-10-16)

Provenance: the owner selected the experience and security options during WEB-M1-001 planning, corrected the launch market to Macedonia and the languages to mk/en/bg/sq, explicitly deferred MFA entirely for this MVP, then instructed implementation of the resulting plan. These are owner decisions, not agent-inferred approvals. Approval of design scope does not mark the completed [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) Accepted; the owner subsequently accepted its identity/session and PUBLIC_ORIGIN design during WEB-M1-003; media/administrator review remains pending.

### Experience and route map

- Launch locales: Macedonian (`mk`, default), English (`en`), Bulgarian (`bg`), Albanian (`sq`). Use a repository-owned build-time locale registry and separate typed static message dictionaries in `src/lib/i18n`; all enabled dictionaries must have complete keys. Translation/configuration changes use the normal build/release. No runtime translation service or locale preference cookie.
- Additional languages require registry entries and complete messages, not route-code changes. Translate interface text and static metadata; provider-authored text remains as supplied, with no automatic translation or invented multilingual API fields.
- Neutral blue/teal medical presentation, system fonts, accessible contrast, visible focus and mobile-first sections; no invented brand/logo or external font. Show only explicitly supplied, API-supported professional contact links; login identity is never a public contact source.

| Purpose | Reserved web route |
|---|---|
| Localized entry | `/[locale]` |
| Public profile | `/[locale]/doctors/[slug]` |
| Provider workspace | `/[locale]/provider` |
| Solo onboarding | `/[locale]/provider/onboarding` |
| Profile and optional photo | `/[locale]/provider/profile` |
| Services / locations | `/[locale]/provider/services`, `/[locale]/provider/locations` |
| Credentials and private evidence | `/[locale]/provider/credentials` |
| Publication controls | `/[locale]/provider/publication` |
| Administrator workspace | `/[locale]/admin` |
| Doctor / credential review | `/[locale]/admin/doctors`, `/[locale]/admin/credentials` |

Bare product entry paths redirect to the equivalent `mk` path; `/` redirects to `/mk`. Language links preserve the corresponding page and stable slug, without carrying sensitive query parameters. Unsupported locales return not-found. Operational `/healthz`, `/system-status` and API `/api/*` paths remain unprefixed. Review detail identifiers come from the generated contract; no DTO or identifier shape is defined here.

Onboarding is a resumable checklist: Google sign-in → one solo workspace → profile, services, location and credentials (photo optional) → submission/review → explicit owner publication when API eligibility permits. Doctor approval, credential approval and publication remain distinct; the API owns completeness, transitions and suspension rules. MVP scope is profiles, credentials, services, locations, photo, provider editing, administrator approval and explicit publication; directory/search, appointments, analytics, maps, clinic teams, patient accounts and detailed medical data remain excluded.

### Security decisions and approval boundaries

- Owner-approved MVP policy: defer MFA entirely, including administrator actions. Retain API-owned stored privileges, controlled administrator bootstrap, tenant isolation and audit requirements. This records policy intent; it does not disable API checks.
- Owner-approved design scope: API-owned session cookies (HttpOnly, host-only, Path=/, SameSite=Lax, Secure except explicit local HTTP), narrow server-only session/CSRF forwarding and cookie propagation, and validated server-only `PUBLIC_ORIGIN` for canonical URLs and origin checks.
- Owner-approved photo design: publication-aware same-origin API delivery, no-store, no durable public object URLs or optimized cached derivatives; evidence remains private. Revocation applies to subsequent requests, not copies already downloaded.
- The Proposed ADR specifies navigation, CSRF and propagation boundaries and their required tests. No application configuration, cookies, source, dependency, API repository, edge, CI or deployment is changed by this task; later boundary implementation still requires reviewed tests and human review.

### Capability observations and remaining gates

Installed client `@dadzhioski/professional-services-api-client@0.2.0` exposes IdentityApi login request options, callback, current-account, CSRF and logout methods plus system/health APIs. CurrentAccount provides accountId, emailVerified and sessionExpiresAt, not administrator authority or MFA assurance. Profile, onboarding, catalog, media, credential, review and publication methods are absent. This inspection is not registry-publication or deployed-compatibility proof; no client upgrade is authorized.

| Gate / ownership | Dependent work and release condition |
|---|---|
| Completed ADR review — owner | Identity/session and PUBLIC_ORIGIN design accepted by the owner in WEB-M1-003; implementation test/human review and other boundary reviews remain required; recorded experience decisions already permit WEB-M1-002 synthetic presentation work |
| Administrator policy reconciliation — API owner | Amend linked API-M1-003/004/007/008/009 requirements to the owner's MVP-wide deferral and supply compatible authorization behavior; WEB-M1-010 and administrator evidence access remain blocked, with no local bypass |
| Identity provenance/compatibility and localized return allowlist — WEB-M1-003 / API-M1-003 | Verify published client and compatible API behavior, including exact localized return destinations; no live Google acceptance claimed |
| Published feature contracts — WEB-M1-004 and linked API tasks | Onboarding/editing/catalog/media/credential/review/public-profile integrations wait for their actual capabilities and approved exact client adoption; never invent DTOs |
| Photo eligibility and no-store delivery — API-M1-007/009/010 | WEB-M1-008/011 media integration waits for contract-backed revocation behavior; public contact fields likewise require explicit public DTO support |

API task links are maintained in [Milestone 1](../backlog/milestone-1.md#linked-api-work). Read-only inspection found the MFA deferral in API-M1-003 and continuing administrator MFA requirements in 004/007/008/009; no API-owner amendment or live compatibility evidence is recorded. Independent presentation and provider planning do not wait for administrator reconciliation or formal Milestone 0 acceptance. Deferred Milestone 0 obligations remain open, including the unchanged dependency-exception expiry.

## Acceptance criteria

- [x] Decisions, route map, unresolved approvals and feature-specific blockers are explicit; no unresolved decision is labeled accepted.
- [x] Independent presentation work is distinguished from auth, API and administrator blockers; deferred Milestone 0 acceptance is not a prerequisite.
- [x] Links, task dependencies and recorded decisions are internally consistent.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Documentation evidence (2026-10-16): local Markdown targets/anchors checked across the milestone tasks, backlog, build plan and ADRs; decision/dependency consistency reviewed and `git diff --check` passed. These checks establish the documentation criteria only, not ADR acceptance or completed API policy reconciliation. Runtime, Google, media and VPS checks were not executed and are not applicable to this documentation change.

## Verification

Read the decision record and referenced ADRs, then run:

```powershell
git diff --check
```

Local runtime and non-production VPS checks are not applicable to this documentation task.

## Security and privacy

Authentication cookies, administrator policy, public origin and image-delivery boundaries require explicit review before dependent implementation. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

