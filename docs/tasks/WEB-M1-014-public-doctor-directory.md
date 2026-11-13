# WEB-M1-014: Add a public doctor directory with specialty and city filters

- **Status:** IMPLEMENTED (2026-10-26); local checks passed, non-production VPS checks not executed. Approved for implementation by the owner on 2026-10-26. The owner amended [Milestone 1](../backlog/milestone-1.md#scope-and-milestone-acceptance) scope to include this directory, which WEB-M1-001 previously excluded, and accepted the defaults for every decision below.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-011 (public profile route, anonymous public wrapper, public photo path, SEO helpers and fixture routes); WEB-M1-013 (site header and entry page); owner decisions below
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (accepted for identity/session, PUBLIC_ORIGIN and media)
- **Cross-repository dependency:** [API-M1-010](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-010-public-profiles-and-directory.md). Pinned client 0.7.0 already contains `PublicApi.listPublicDoctors` (`specialtyId`, `cityId`, zero-based `page`, `size`) returning `PublicDoctorPage` / `PublicDoctorSummary`, and the anonymous `ReferenceApi` specialty and city lists. No client upgrade is expected.
- **Risk:** Medium

## Goal

An anonymous visitor can find published doctors from the header or the entry page, narrow the list by specialty and city, and open a doctor's public profile, without JavaScript.

## Context (2026-10-26)

WEB-M1-011 made published profiles reachable only by direct link (`/[locale]/doctors/[slug]`). The header and entry page (WEB-M1-013) link only to the doctor sign-in area. The API already provides a published-only, paginated directory with AND-combined specialty and city filters, ordered by display name; unknown but well-formed filter IDs return an empty page, and malformed IDs or page/size outside 0-based paging and size 1–100 return Problem Details.

## Allowed scope

- New route `src/app/[locale]/doctors/page.tsx` and a directory feature under `src/features/public-directory`.
- A server-only anonymous directory wrapper next to `src/lib/api/public-profile.ts`, reusing `sessionConfiguration(undefined)`, and reuse of `listSpecialties` / `listCities` from `src/lib/api/reference.ts`.
- A directory link in `src/components/site-header.tsx` and on the entry page `src/components/home.tsx`; bare `/doctors` redirects to `/mk/doctors` in `src/app/(operational)/doctors/[[...path]]/page.tsx`.
- Typed translation keys in all four locales, unit tests and extensions of the existing Playwright fixture (`/api/v1/public/doctors`) for this task's requirements; no unrelated refactor.

## Non-goals

- No free-text or name search, sorting options, ranking, recommendations, maps, geolocation, distance, availability or booking.
- No appointment requests, patient accounts, reviews or ratings, analytics, cookies, tracking, external scripts or new dependencies.
- No change to the public profile page beyond a link back to the directory, and no change to provider or administrator pages.
- No change to Caddy, CI, deployment, the session/CSRF transport, `PUBLIC_ORIGIN` handling or the login return allowlist.
- No API source, OpenAPI generation, database work, API deployment, pushing or pull requests unless requested.

## Owner decisions (2026-10-26)

The owner accepted the default for each decision. Each entry keeps the question and records the decision after it.

1. **Scope amendment.** Approve adding the directory to Milestone 1 (or assign it to a later milestone). **Decision:** added to Milestone 1.
2. **Header and entry wording.** The header's signed-out link is currently "For doctors" (`navigation.doctors`) and leads to sign-in. Decide the patient-facing label (for example "Find a doctor"), its position relative to the doctor entry, and the entry-page call to action. This also settles WEB-M1-013 decision 2 for the patient side. **Decision:** a neutral "Doctors" directory link placed before the doctor entry, which keeps its current label; the entry page gets a matching call to action.
3. **Photos in the list.** The public photo route serves the original image with no derivatives (WEB-ADR-0006), so each result downloads the full image. Decide whether results show photos. **Decision:** show the photo with `loading="lazy"` at a fixed small display size.
4. **Indexing.** Decide whether search engines index the unfiltered directory only, or also filtered and paginated pages. **Decision:** index the first unfiltered page; filtered and later pages are `noindex, follow` with the canonical pointing to the unfiltered directory.
5. **Albanian labels.** The reference contract has no `sq` labels, so Albanian shows stable codes (for example `cardiology`) in filters and results (owner decision 2026-10-22). The directory makes this more visible; decide whether to keep it or request `sq` labels through a linked API task. **Decision:** keep the code fallback; no linked API task.

## Requirements

1. Route `/[locale]/doctors` for mk/en/bg/sq; unsupported locales return not-found; bare `/doctors` redirects to `/mk/doctors`. The route coexists with `/[locale]/doctors/[slug]`.
2. Use only generated public DTOs (`PublicDoctorPage`, `PublicDoctorSummary`, `PublicReference`) through a server-only anonymous wrapper with result states `ready | invalid | unavailable`; forward no visitor cookie, use no shared or ISR cache, and validate the response shape (slug, display name, references, page numbers) before rendering.
3. Filters are a plain `GET` form (`specialty`, `city`, `page` query parameters) built from the reference lists and labelled with `referenceLabel`. It works without JavaScript; there is no client-side fetching. Cities are grouped by country or labelled with their country. Selected values stay selected after submit.
4. Query parameters are validated before the API call: unknown parameter names are ignored; filter IDs must be well-formed reference IDs present in the loaded reference lists; `page` is a positive integer shown 1-based and sent 0-based. Invalid values render a translated message with the unfiltered first page or a reset link, never a raw API error. A page beyond the last page shows an empty-page message with a link to the last page.
5. Page size is fixed at 20 (the API default). Pagination uses links (previous/next and the current page of the total) inside a labelled `<nav>`, with `aria-current="page"` and `rel="prev"`/`rel="next"`.
6. Each result shows the display name linking to `/[locale]/doctors/[slug]`, the specialty and distinct cities, and per decision 3 the photo from `publicMediaContentPath` through the existing plain `<img>` (no `next/image`, no derivatives, `alt=""` beside the linked name). No biography, credentials, prices, contact data or identifiers beyond the slug.
7. States: results; no published doctors at all; no matches for the selected filters (with a reset link); reference lists unavailable (the list still renders without filters if the directory read succeeds); directory unavailable (translated alert, `noindex`). All are server-rendered.
8. Metadata: translated title and description; canonical, language alternates and robots per decision 4 using `canonicalUrl`/`languageAlternates` from `src/lib/seo/canonical.ts` (validated `PUBLIC_ORIGIN` only). Language links keep the existing `languagePath` behaviour, which drops query parameters, so switching language resets filters. Optional `ItemList` structured data is out of scope.
9. Header and entry page link to the directory per decision 2 on every localized page, keeping the existing doctor sign-in entry, `aria-current="page"` on the directory page, 44 px targets and 320 px layout. The public profile page gains a "back to doctors" link.
10. Provider-supplied names and labels are rendered as text only; malicious strings stay inert. No PII, session values or query strings are logged.
11. Accessibility: one `h1`, labelled form controls with a visible submit button, the result count announced as plain text near the list, results as a list of articles or list items with headings, visible focus and no new axe violations.
12. All user-visible text and metadata use typed keys with complete mk, en, bg and sq dictionaries.
13. Tests:
    - Wrapper: exact URL and query encoding, no cookie, `no-store`/`omit`/`redirect: "error"`, 400 becomes `invalid`, 5xx/network/timeout/malformed become `unavailable`, Set-Cookie refusal.
    - Page SSR for every locale: results, each empty state, invalid filter/page, page beyond the end, reference unavailable, directory unavailable, malicious names, metadata per decision 4, axe.
    - Header and entry page links in signed-out and signed-in states.
    - Playwright with the fixture: JavaScript-disabled filtering and pagination, keyboard and axe, desktop and Pixel 7, 320 px; a profile that is unpublished or suspended disappears from the next directory request and its photo is denied; no private values in HTML.
14. Read [Milestone 1](../backlog/milestone-1.md) and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.

## Acceptance criteria

- [x] (owner) Scope amendment recorded in this task and in `docs/backlog/milestone-1.md`.
- [x] From any localized page a visitor reaches the directory in one click from the header, and from the entry page.
- [x] Specialty and city filters, alone and combined, and pagination work without JavaScript; invalid input and out-of-range pages render safe translated states.
- [x] Results link to published profiles only; unpublished or suspended doctors and their photos disappear on the next request.
- [x] Empty, no-match, reference-unavailable and directory-unavailable states are server-rendered and the failure state is not indexed.
- [x] Keyboard, axe, mobile/desktop and 320 px checks pass; HTML contains no private data.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; the pinned client is unchanged.
- [x] (owner) Header and entry wording, photo, indexing and Albanian-label decisions recorded in this task.
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

**Local:** Use the isolated browser fixture for the scenarios above; no running API or real personal data is needed. For live checks, start `npm run dev` with existing local API configuration and at least two published synthetic doctors with different specialties and cities. Open `http://localhost:3000/mk`, follow the header link to the directory, filter by specialty, then by city, page through results, and open a profile. Repeat with JavaScript disabled, after unpublishing one doctor (it disappears on refresh), and with the API stopped (expect the unavailable message).

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, with the published full commit-SHA release. Open `/mk/doctors` on the site origin and repeat the local checks with synthetic accounts; check `/healthz` and `/system-status` for regressions. Record the release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

Evidence (2026-10-26): lint (excluding the untracked local `.claude/worktrees` checkout), type check, unit tests, production build, policy tests, API-client policy (0.7.0) and `npm run e2e` (desktop and Pixel 7) passed. The reference reads also include `listCountries`, so city options can be grouped by country; if it is unavailable, the groups show country codes.

## Security and privacy

Directory reads are anonymous and forward no visitor cookie; output is not cached or shared between users, so unpublish and suspension apply on the next request. Only published professional fields from the generated public DTOs are shown; no account, organization, review or evidence data, and no PII, session values or query strings in logs. Filter values are reference IDs, not free text, and are validated before they reach the API. Never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks, open owner decisions and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.
