# WEB-M1-011: Integrate public server-rendered doctor profiles and SEO

- **Status:** IMPLEMENTED LOCALLY (2026-10-26) against pinned client 0.7.0, which contains `PublicApi.getPublicProfile` and `MediaApi.getPublicMediaContent`, so the earlier capability block is resolved. Owner decision (2026-10-26): the photo is not placed in og:image or JSON-LD, because third-party copies would outlive revocation. A transient API failure renders HTTP 200 with noindex (not a 5xx). Live API and non-production checks are pending.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-002; WEB-M1-004 public-profile capability; WEB-M1-001 route/origin decisions
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (Proposed; owner design scope recorded in WEB-M1-001)
- **Cross-repository dependency:** [API-M1-010](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-010-public-profiles-and-directory.md)
- **Risk:** Medium

## Goal

Serve an anonymous, indexable profile containing only currently published professional data.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## WEB-M1-001 decisions and implementation coverage

Use /[locale]/doctors/[slug] for mk/en/bg/sq, with mk default; translate interface/static metadata and retain provider content as supplied. Reuse validated server-only PUBLIC_ORIGIN from 003 if available; otherwise implement the same reviewed validator independently, since public SSR does not depend on auth completion. Test invalid origins, spoofed Host/forwarded headers, environment boundaries, localized canonical URLs and SSR language. Use reviewed no-store publication-aware API photo delivery and test revocation after prior reads; no photo optimizer, public object URL or private evidence in metadata.

## Requirements

1. Implement the approved slug route using only generated public-profile DTOs through a server-only anonymous wrapper; do not reuse owner DTOs or forward visitor session cookies.
2. Render profile, approved credentials, services, locations and eligible optional photo in initial HTML. No client JavaScript is needed to read the profile.
3. Map API unknown/unpublished/suspended responses to the same safe not-found result; distinguish transient API failure with a translated unavailable state and prevent failure content from being indexed.
4. Generate title, description, canonical URL, social metadata and safely serialized structured data from eligible public fields and the approved canonical origin. No fabricated ratings, unsupported claims, private identifiers or login email.
5. Use no shared profile/metadata/photo cache in this milestone so the next request reflects unpublish/suspension. Avoid optimized image derivatives retaining revoked media; follow 001's reviewed delivery design.
6. No directory, search, maps, appointment form, analytics or fake live content; malicious biography/metadata strings remain inert text.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
9. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [x] Published success, missing/hidden profiles, unavailable API, empty optional data and malicious text have SSR/metadata tests.
- [x] JavaScript-disabled reading, keyboard/axe, mobile/desktop and publication revocation checks pass; public HTML/JSON-LD contain no private data.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

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

