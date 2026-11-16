# WEB-M2-009: Sync the docs/design mockups with the current implementation

- **Status:** IMPLEMENTED (2026-11-16) on branch `WEB-M2-009`; manual 320/1280 px comparison and the non-production VPS check not run
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-019 merged (done, PR #30); `docs/design` snapshot of 2026-11-13 (merged, PR #31)
- **Blocks:** WEB-M2-002 (request form presentation) and the presentation parts of WEB-M2-004, 005 and 006
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md); WEB-M1-019 owner decisions (2026-11-05)
- **Cross-repository dependency:** None for this task. Design elements that need data the pinned client lacks are listed as API requests, not implemented
- **Risk:** Medium (changes the look of public, provider and admin pages; no behavior or data change)

## Goal

Before Milestone 2 feature work starts, the design mockups in `docs/design` and the running pages agree: every difference is either fixed in code, fixed in the design, assigned to a Milestone 2 task, raised as an API request, or rejected with a reason. Milestone 2 tasks then build on one agreed visual reference.

## Context (inspected 2026-11-16)

- The mockups (`Doctors`, `Main`, `Request`, `Provider`, `ProviderCalendar`, `Admin`) were made after WEB-M1-019 but do not use its tokens. They use a blue accent (`#0B5CAD`), slate neutrals, a 1200 px container, a logo mark, light footer with links, and client-side state (`aria-pressed` buttons, tabs, toggles).
- The implementation uses the approved WEB-M1-019 teal tokens in `src/app/globals.css`, a shared `max-w-3xl` column (WEB-M1-018), a text wordmark, a dark single-notice footer, and server-rendered forms and links only.
- `package.json` pins client 0.7.0. Local `node_modules` held 0.9.0 when this task was drafted, so run `npm ci` before checking fields. The field notes below come from 0.9.0 and must be rechecked against the pinned version.
- The live canvas may be newer than the files (see `docs/design/README.md`). Use the files in Git as the reference unless the owner says otherwise.

## Owner decisions needed

1. **Source of truth for colour.** (a) Keep the WEB-M1-019 tokens and update the mockups to them (default), or (b) adopt the mockups' blue accent, which reopens WEB-M1-019 decision 1 and its contrast table.
2. **Container width.** Keep `max-w-3xl` (default; directory stays 2 columns) or widen public pages to roughly 1200 px as in the mockups (3-column directory, profile sidebar).
3. **Header.** Keep the text wordmark (WEB-M1-019 decision 5) or add the "+" logo mark; label links "Find a doctor" / "For doctors"; language switch as a compact pill group of links (must stay `<a hreflang>` links, not buttons).
4. **Footer.** Keep the dark single-notice footer (WEB-M1-019 decision 4) or the mockups' light footer. Privacy, Terms and Contact links need real pages and copy, which are out of scope unless approved.
5. **Profile layout.** The mockup's tab bar needs JavaScript. Replace it with an in-page anchor list (default) or drop it. Services as cards conflict with the WEB-M1-017 price-list table; keep the table (default) or approve a card layout that keeps the same content.
6. **Provider and admin shell.** Keep the current top header (default) or adopt the mockups' dark sidebar (provider) and dark admin header with an "ADMIN" label.
7. **Calendar view.** `ProviderCalendar` is out of Milestone 2 scope ("calendars or availability", `milestone-2.md`). Confirm it stays deferred.
8. **Request-flow details for WEB-M2-001.** The `Request` mockup feeds WEB-M2-001 and is not built here. Record the owner's view on: picking a published service in the form; a single "phone or email" field versus separate typed fields (WEB-M2-002 requirement 3); and the "Cancel this request" button on the confirmation screen versus cancellation only through the signed link (WEB-M2-005).

### Recorded owner decisions (2026-11-16)

1. **Colour:** keep the WEB-M1-019 tokens; the mockups move to the token values.
2. **Container width:** about 1200 px (`--container-page: 75rem`) on all pages, public, provider, admin and status. Forms and text stacks stay capped at `max-w-3xl` inside it. Directory is 3 columns at `lg`; profile has a sidebar at `lg`.
3. **Header:** add the decorative "+" mark (reopens WEB-M1-019 decision 5; the mark is `aria-hidden`, so the wordmark's accessible name is unchanged). Nav links are "Find a doctor" and "For doctors". The language switch is a pill group of `<a hreflang>` links.
4. **Footer:** keep the dark single-notice footer. No Privacy, Terms or Contact links.
5. **Profile layout:** no in-page navigation; the tab bar is rejected. Keep the WEB-M1-017 price-list table.
6. **Provider and admin shell:** keep the shared top header. The provider sidebar and the dark admin header are rejected.
7. **Calendar:** deferred out of Milestone 2; recorded as API work to request.
8. **Request flow (for WEB-M2-001/002):** the form picks one of the doctor's published services; phone and email are separate typed fields; cancellation is only through the signed link (no "Cancel this request" button on the confirmation screen).

Additional rows decided with the owner: "Popular" specialty chips → Reject (the specialty select covers it). "Credentials verified" badge → Reject.

Pinned client 0.7.0 rechecked after `npm ci`. It carries every field the Build rows use: `PublicDoctorSummary` (`slug`, `displayName`, `photoMediaId`, `specialty`, `cities`); `PublicProfileResponse` (`biography`, `credentials`, `locations`, `services`, `specialty`); `PublicCredential` (`title`, `issuer`, `issuedOn`); `PublicPracticeLocation` (`label`, `displayAddress`, `city`). `ProfileResponse` carries `slug`. No admin review response carries a slug.

The final register is in `docs/design/README.md`.

## Sync register (initial classification)

Classes: **Build** = presentational, data already available, done in this task. **M2** = belongs to the named Milestone 2 task. **API** = needs a field or parameter the pinned client lacks; raise with the API owner, do not build. **Decision** = owner decision above. **Reject** = conflicts with AGENTS.md, an ADR or accessibility; fix the mockup instead.

### Directory (`Doctors.dc.html` → `/[locale]/doctors`)

| Mockup element | Class | Note |
|---|---|---|
| Hero heading, subtitle, filter panel with specialty and city selects and submit | Build | Restyle the existing server-rendered form to the mockup's grouped panel using tokens |
| Free-text "Doctor name" search | API | `listPublicDoctors` takes only `specialtyId`, `cityId`, `page`, `size` |
| "Popular" specialty chips | Decision / Build | Possible as plain links to `?specialty=<id>`; needs an owner-chosen list or an API signal of popularity |
| "Accepting new patients" filter and badge, "Waitlist only" | API | No such field |
| Languages line, practice name on card | API | Not in `PublicDoctorSummary` |
| Card: portrait or initials, name, specialty, city, "View profile" with arrow | Build | Whole card as one link target, keep a single accessible name |
| Result count with active filters, "Clear filters" | Build | Count exists; add clear link when filtered |
| Empty state card with icon and clear action | Build | Restyle existing `directory.noMatch` state |
| Hover lift animation | Build | Only under `prefers-reduced-motion: no-preference` |
| 3-column grid | Decision 2 | |

### Public profile (`Main.dc.html` → `/[locale]/doctors/[slug]`)

| Mockup element | Class | Note |
|---|---|---|
| Breadcrumb Doctors / specialty / name | Build | `nav aria-label` with `aria-current` on the last item |
| Header card: large portrait, name, specialty line, city | Build | City from published locations |
| "Credentials verified" badge | Decision | Wording must reflect what admin review actually checks; no per-credential claim |
| "Accepting new patients" badge, languages, sub-specialty | API | Not in the public profile response |
| "Request an appointment" primary CTA and "not a booking" note | M2 (WEB-M2-004) | Not shown until submission works |
| "Call the practice" button, practice contact card (phone, email) | API | No contact fields in the public response |
| Tab bar | Decision 5 | |
| About section | Build | `biography` |
| Services with duration and price | Decision 5 / API | No duration field; price list stays as WEB-M1-017 unless decided |
| Credentials list with issuer and year | Build | `title`, `issuer`, `issuedOn` year |
| Location cards with map placeholder and hours | Build / API / Reject | Label and address: Build. Hours: API. Maps: out of scope (no third-party scripts) |
| "Your privacy" note in sidebar | Build | New translated copy in mk, en, bg, sq; supports the data-scope rule |

### Request flow (`Request.dc.html`)

Not built here. Hand the mockup to WEB-M2-001 (decision 8) and WEB-M2-002. Keep in the mockup: three numbered fieldsets, fixed time-preference choices, the medical-data warning, consent with a privacy link, summary sidebar and the three-step "what happens next" list. Fix in the mockup: selection controls must be radio inputs, not `aria-pressed` buttons, so the form works without JavaScript; the error state needs an error summary (WEB-M2-002 requirement 2).

### Provider (`Provider.dc.html`, `ProviderCalendar.dc.html` → `/[locale]/provider`)

| Mockup element | Class | Note |
|---|---|---|
| Sidebar navigation | Decision 6 | "Settings" has no page |
| "Good morning, Dr. …" greeting | Reject | Time of day depends on the visitor's clock; use a neutral greeting |
| Checklist with progress bar and "n of m complete" | Build | Restyle the WEB-M1-015 checklist; keep its real steps (the mockup's "Contact" step has no backing data) |
| "Submit for review" with disabled state | Build | Match existing publication rules; disabled control must explain why in text |
| "Preview public profile" link | Build | Only when a published profile exists |
| Requests table, Accept / Decline / Undo, pending badge | M2 (WEB-M2-006) | "Undo" and the missing "propose another time" go to WEB-M2-001 |
| Calendar view | Decision 7 | Deferred |

### Admin (`Admin.dc.html` → `/[locale]/admin`)

| Mockup element | Class | Note |
|---|---|---|
| Dark admin header with label | Decision 6 | |
| Queue and detail side by side, status filters | Build | Only with existing admin data and routes; filters as links |
| Reviewer check toggles | Reject | Client-only state with no stored result; misleading in a review record |
| "Changes in this submission" | API | No change summary in the client |
| "Audit log" navigation | API | No capability |
| Approve and publish, Request changes, Preview | Build | Restyle the existing actions only |

### Cross-cutting fixes to the mockups

- Focus ring `#93C5FD` is below 3:1 on white; use `--color-focus`.
- Language switch and filters are buttons with client state; they must be links or form controls.
- Animations must respect `prefers-reduced-motion`.
- Replace hard-coded colours with the token names once decision 1 is recorded.

## Allowed scope

- `docs/design/*.dc.html`, `docs/design/README.md`: align mockups with decisions and add the final sync register (this table, updated) to the README.
- Styling and markup of existing pages and components for rows classed **Build**: `src/components/**`, `src/features/public-directory`, `src/features/professional-profile`, `src/features/provider-onboarding`, `src/features/admin-review`, the matching `src/app/[locale]/**/page.tsx`.
- `src/app/globals.css` only for token additions required by recorded decisions (contrast-checked).
- Typed translation keys in mk, en, bg and sq for new copy (privacy note, breadcrumb, clear filters, neutral greeting).
- Amendments to WEB-M2-001, 002, 004 and 006 that reference the agreed mockups and the decisions under 8; a row in `docs/backlog/milestone-2.md`.
- Unit and Playwright test updates.

## Non-goals

- No request form, route, Server Action, API wrapper or fixture for appointment requests.
- No field, parameter or data the pinned client lacks; no hand-written DTOs; no client upgrade.
- No calendar, maps, ratings, free-text search, analytics, web fonts, icon library or new dependency. Inline SVG icons in source are allowed only if decorative (`aria-hidden`).
- No change to metadata, SEO, routes, `lang`/`hreflang`, session/CSRF, Caddy, CI or deployment.
- No new Client Components.

## Requirements

1. Owner decisions 1–8 are recorded in this file before any code change.
2. Every row of the register ends in exactly one final class with an owner or task ID; no row stays open.
3. Each **API** row is listed in `docs/backlog/milestone-2.md` under "API work to request". This repository does not create API tasks.
4. **Build** rows meet WEB-M1-019 requirements 1–5 and 9–12 (tokens only, type scale, 44 px targets, AA contrast, 320 px, JavaScript-disabled rendering, four locales).
5. Public pages stay Server Components and render fully without JavaScript; no new `"use client"` file.
6. After decisions, the mockups use the token values and show no element that the register rejects.

## Acceptance criteria

- [x] (owner) Decisions 1–8 recorded.
- [x] Final sync register in `docs/design/README.md`; every row classified.
- [x] Directory, profile, provider overview and admin review match the agreed mockups for all **Build** rows.
- [x] Mockups updated to the decisions; `Request.dc.html` is referenced from WEB-M2-001 and 002.
- [x] API requests added to the Milestone 2 backlog; nothing built on missing data.
- [x] No new dependency, Client Component, external asset or API call; pinned client unchanged.
- [x] Lint, types, unit tests, production build, affected Playwright tests and API-client policy pass.

## Verification

```powershell
npm ci
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
$env:PUBLIC_ORIGIN = 'http://localhost:3000'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run e2e
git grep -nE "(text|bg|border|ring|outline)-(teal|slate|blue|red|gray|sky)-[0-9]+" -- src/components src/features
git grep -n '"use client"' -- src/features/public-directory src/features/professional-profile
git diff --check
```

Both `git grep` checks must return nothing.

**Local:** `npm run dev`; compare `/mk/doctors`, a published `/en/doctors/<slug>`, `/en/provider` and `/en/admin` with the matching mockup on the live canvas at 320 px and 1280 px; repeat the directory and profile with JavaScript disabled.

**Non-production VPS:** deploy with the `Deploy web` workflow (full SHA) and repeat the directory and profile checks through the site address; no edge checks needed.

## Security and privacy

No new data, requests, cookies, scripts or environment variables. The privacy note and the "not a booking" note support the data-scope rule. No design element may ask for symptoms, diagnoses or other detailed medical data.

## Handoff

Report the recorded decisions, the final register, rows moved to API or M2 tasks, contrast results for any new token, screenshots at 320 and 1280 px, checks, SSR and accessibility impact, client version (unchanged) and unexecuted checks.
