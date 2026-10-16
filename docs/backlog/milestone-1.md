# Web Milestone 1 — Frontend planning authorization

- **Status:** AUTHORIZED FOR PLANNING AND IMPLEMENTATION (owner decision, 2026-10-16); individual tasks not yet created.
- **Direction:** Public doctor profiles and provider onboarding, as described in `build-plan.md`.
- **Starting point:** Implemented Next.js/SSR foundation, exact generated API client, CI/images and owner-confirmed working first non-production deployment.
- **Milestone 0:** Formal acceptance remains open; deferred work is tracked in `milestone-0.md` and does not block unrelated frontend work.

## Instructions for the next task-planning request

1. Create scoped `WEB-M1-*.md` tasks using the existing template when requested; this note is not itself an implementation task or a complete feature specification.
2. Do not depend on "Milestone 0 complete", WEB-M0-007, or remaining WEB-M0-006/008 operational proof merely to start frontend work. Reference implemented foundations where useful, explicitly distinguishing available implementation from deferred acceptance.
3. Keep rollback proof, historical hosted evidence, clean-room acceptance, documentation reconciliation and final Milestone 0 sign-off as separate follow-up work, not mandatory acceptance criteria copied into every frontend task.
4. Determine dependencies from the feature itself: design/content decisions, shared components and the actual published API-client capabilities. Inspect the contract before promising data-backed profile, onboarding, provider editing or administrative behavior; do not assume the status endpoint implies those capabilities exist.
5. Separate independent presentation work from API-dependent integration where useful. Synthetic content for explicitly scoped previews/tests is allowed, but must not masquerade as live integration or introduce handwritten API DTOs. Missing API behavior requires a linked API task and blocks only the dependent integration work.
6. Preserve task-level tests, SSR, accessibility, translation keys, privacy constraints, exact client pinning and existing CI/security gates. This authorization does not approve dependency upgrades, new runtime secrets, external scripts, detailed medical-data collection or production deployment.
7. Do not silently extend the dependency-audit exception expiring 2026-10-26 at 00:00 UTC. Track its remediation separately from frontend planning; report any actual failed gate on the work it affects.

## Deferred acceptance

See the [Milestone 0 deferred-work register](milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Leave incomplete checks open and distinguish owner-reported deployment success from independently inspected evidence. The owner has already authorized proceeding; no repeat transition approval is required.
