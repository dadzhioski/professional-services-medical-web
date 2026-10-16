# WEB-M1-002: Build shared UI and a synthetic profile presentation

- **Status:** PLANNED — applicable decisions/approvals from WEB-M1-001 required
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-001 experience decisions
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; decisions recorded by WEB-M1-001 where applicable
- **Cross-repository dependency:** None
- **Risk:** Low

## Goal

Provide an accessible, responsive profile presentation and reusable form primitives independently of feature API availability.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## Requirements

1. Use Tailwind and the existing source-owned UI, extending only components used by this milestone: headings, sections, labelled fields, errors, notices and buttons.
2. Render profile sections for professional introduction, specialties, credentials, services, locations and optional photo; follow approved content and route decisions from 001.
3. Keep synthetic examples in tests or an explicitly non-production preview; never publish a fake doctor as a live profile or add a runtime fallback.
4. Use presentation-only component props, not DTO-shaped mock contracts; real integration later derives data types from the generated client.
5. Use typed translation keys, semantic landmarks, skip navigation, visible focus and responsive layout; omit unsupported or empty optional sections cleanly.
6. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
7. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
8. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [ ] Synthetic profile content renders in initial HTML with JavaScript disabled.
- [ ] Keyboard, axe and mobile/desktop checks cover long content, missing photo, empty optional sections and field errors.
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

**Non-production VPS:** No deployment is required for test-only presentation. If this task adds approved public-facing UI, verify it through the existing non-production release procedure. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

