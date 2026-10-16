# WEB-M1-001: Resolve Milestone 1 experience and security decisions

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** None
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; decisions recorded by WEB-M1-001 where applicable
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
2. Obtain owner decisions on first-market language/content, visual identity, public profile route, provider/admin route map, onboarding steps and public contact presentation. Proposed routes are /doctors/[slug], /provider and /admin; retain current English-only translations until the first-market decision is recorded.
3. Resolve the API-M1-003 Google-only/MFA-deferral revision against API-M1-004/007/008/009 administrator MFA requirements with the API owner. Do not infer an MFA-free administrator path or implement MFA locally.
4. Specify the same-origin Google navigation, server-only session/CSRF adapter and cookie propagation design before authentication implementation. Obtain explicit approval for required session cookies and environment-boundary changes; no new auth provider, browser API SDK or web-owned OAuth secrets.
5. Decide canonical public origin configuration and publication-aware photo delivery without trusting arbitrary Host headers or permitting stale cached revoked images. Any new configuration or boundary change needs its own reviewed tests.
6. Record scope: profile, credentials, services, locations, photo, provider editing, administrator approval and explicit publication. No directory/search, appointments, analytics, maps, clinic teams or patient accounts in this milestone unless the owner amends scope.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Do not approve decisions on behalf of the owner; unresolved items block only dependent work.
9. Inspect the relevant installed client and linked API tasks; contract gaps remain linked blockers, never invented DTOs.

## Acceptance criteria

- [ ] Decisions, route map, unresolved approvals and feature-specific blockers are explicit; no unresolved decision is labeled accepted.
- [ ] Independent presentation work is distinguished from auth, API and administrator blockers; deferred Milestone 0 acceptance is not a prerequisite.
- [ ] Links, task dependencies and recorded decisions are internally consistent.
- [ ] No deferred Milestone 0 obligation is marked passed or waived.

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

