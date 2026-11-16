# Medical Web — UX design mockups

Interactive design mockups for the medical web product, derived from [`build-plan.md`](../../build-plan.md). They are a **visual reference** for WEB tasks, not production code: the real implementation uses Next.js App Router, Tailwind and the source-owned component set.

- **Live canvas (private, shareable from its Share menu):** https://claude.ai/artifact/MhQPtGrpGDW9VosgBZ5mEA
- **Snapshot date:** 2026-11-13, aligned in Git by [WEB-M2-009](../tasks/WEB-M2-009-design-sync.md) on 2026-11-16. The files in Git are the reference; the live canvas has not been updated and may differ.

## Screens

| File | Screen | Route | Status |
|---|---|---|---|
| `Doctors.dc.html` | Doctors directory: specialty and city filters | `/[locale]/doctors` | Aligned (WEB-M2-009) |
| `Main.dc.html` | Public doctor profile: introduction, price list, credentials, locations | `/[locale]/doctors/[slug]` | Aligned (WEB-M2-009) |
| `Request.dc.html` | Appointment request: minimal contact, consent, confirmation | Milestone 2 request flow | Reference for WEB-M2-001, 002, 004 |
| `Provider.dc.html` | Provider overview: checklist, progress; requests table | `/[locale]/provider/onboarding` | Aligned; requests table is a WEB-M2-006 reference |
| `ProviderCalendar.dc.html` | Provider weekly calendar view | none | Deferred (decision 7) |
| `Admin.dc.html` | Admin doctor applications: queue page and detail page | `/[locale]/admin/doctors` | Aligned (WEB-M2-009) |

`canvas.json` holds the canvas layout.

## Notes

- Colours are the WEB-M1-019 token values from `src/app/globals.css`. Canvas `#f3f8f7`, surface `#ffffff`, ink `#0b3b3a`, text `#29403f`, muted `#4f6665`, primary `#0d6e6b`, primary-strong `#0a5654`, accent `#c2553d` (large text only), tint `#dff1ee`, border `#c9dedb`, control `#4f6665`, danger `#b42318`, focus `#1d4ed8`. No other colour is used.
- Page column: 1200 px (`--container-page: 75rem`) on every page; provider, admin and status blocks are capped at 768 px inside it.
- Every page uses the shared header and footer:
  - "+" mark with the wordmark; "Find a doctor" / "For doctors" (or "My workspace" when signed in);
  - a language pill group of `<a hreflang>` links;
  - the dark single-notice footer.
- Choices are links or form controls, never `aria-pressed` buttons. Motion is wrapped in `prefers-reduced-motion: no-preference`. The focus outline is `#1d4ed8`, offset 4 px.
- Doctor, visitor, credential and price values are `[placeholders]`. Specialty and city lists are examples; real values come from the API.
- The `.dc.html` files use the Claude design-canvas format and need its runtime (`support.js`) to render. Open the live canvas link to view or edit them.

## Recorded decisions (2026-11-16)

Full text in [WEB-M2-009](../tasks/WEB-M2-009-design-sync.md#recorded-owner-decisions-2026-11-16).

1. Keep the teal tokens.
2. 1200 px column on all pages.
3. "+" mark, renamed nav links, language pill group.
4. Dark footer.
5. No profile tab bar; keep the price-list table.
6. Shared top header for provider and admin.
7. Calendar deferred.
8. Request form: service picker, separate phone and email, cancel only through the signed link.

## Sync register (final)

Classes: **Build** = done in WEB-M2-009. **Done** = already implemented before WEB-M2-009. **M2** = belongs to the named Milestone 2 task. **API** = needs data the pinned client (0.7.0) lacks; listed in [`milestone-2.md`](../backlog/milestone-2.md#api-work-to-request). **Reject** = removed from the mockup, with the reason.

### Directory (`Doctors.dc.html`)

| Mockup element | Final class | Owner / task | Note |
|---|---|---|---|
| Hero heading, subtitle, filter panel (specialty, city, submit) | Build | WEB-M2-009 | Grouped panel card, bordered labelled selects, plain GET form |
| Free-text "Doctor name" search | API | API owner | `listPublicDoctors` takes only specialty, city, page, size |
| "Popular" specialty chips | Reject | Owner, 2026-11-16 | The specialty select covers it |
| "Accepting new patients" filter, badge, "Waitlist only" | API | API owner | No such field |
| Languages line, practice name on card | API | API owner | Not in `PublicDoctorSummary` |
| Card: portrait or initials, name, specialty, city, "View profile" with arrow | Build | WEB-M2-009 | Whole card is one stretched link named by the doctor; "View profile" is decorative |
| Result count with active filters | Build | WEB-M2-009 | "Doctors found: n" plus "Filtered by: …" |
| "Clear filters" | Done | WEB-M1 | Shown when a filter is active; now a link in the mockup |
| Empty state card with icon and clear action | Build | WEB-M2-009 | |
| Hover lift | Build | WEB-M2-009 | `.hover-lift`, only under `prefers-reduced-motion: no-preference` |
| 3-column grid | Build | WEB-M2-009 (decision 2) | `lg:grid-cols-3` |
| Language buttons with client state | Reject | WEB-M2-009 | Replaced by `<a hreflang>` pill links |
| Light footer with Privacy, Terms, Contact | Reject | Decision 4 | Dark single-notice footer |

### Public profile (`Main.dc.html`)

| Mockup element | Final class | Owner / task | Note |
|---|---|---|---|
| Breadcrumb Doctors / specialty / name | Build | WEB-M2-009 | `nav aria-label`; specialty links to the filtered directory; `aria-current="page"` on the name |
| Header card: portrait, name, specialty, city | Build | WEB-M2-009 | Cities from published locations |
| "Credentials verified" badge | Reject | Owner, 2026-11-16 | Admin review does not verify each claim; the credentials list stands alone |
| "Accepting new patients", languages, sub-specialty | API | API owner | Not in the public profile response |
| "Request an appointment" CTA and "not a booking" note | M2 | WEB-M2-004 | Not shown until submission works |
| "Call the practice", practice contact card | API | API owner | No contact fields in the public response |
| Tab bar | Reject | Decision 5 | Needs JavaScript; no in-page nav |
| About | Done | WEB-M1 | `biography` |
| Services as cards with duration | Reject / API | Decision 5 / API owner | Price-list table kept; duration is an API request |
| Credentials with issuer and year | Build | WEB-M2-009 | Title, issuer, "Issued: year", expiry |
| Location cards | Build | WEB-M2-009 | Label, address, city |
| Location opening hours | API | API owner | Not in the public response |
| Location map | Reject | AGENTS.md | No third-party scripts |
| "Your privacy" note | Build | WEB-M2-009 | Sidebar at `lg`; mk, en, bg, sq |

### Request flow (`Request.dc.html`)

| Mockup element | Final class | Owner / task | Note |
|---|---|---|---|
| Three numbered fieldsets, time preference, medical-data warning, consent with privacy link, summary sidebar, "what happens next" | M2 | WEB-M2-001, WEB-M2-002 | Kept in the mockup |
| Service picker | M2 | WEB-M2-001 (decision 8) | Radio inputs over published services; no duration |
| Combined "phone or email" field | Reject | Decision 8 | Separate typed phone and email fields |
| Selection controls as `aria-pressed` buttons | Reject | WEB-M2-009 | Radio inputs; works without JavaScript |
| Error state without summary | Reject | WEB-M2-002 req. 2 | Error summary added |
| "Cancel this request" on confirmation | Reject | Decision 8 | Only through the signed link (WEB-M2-005) |

### Provider (`Provider.dc.html`, `ProviderCalendar.dc.html`)

| Mockup element | Final class | Owner / task | Note |
|---|---|---|---|
| Dark sidebar navigation, "Settings" | Reject | Decision 6 | Shared top header and workspace link list |
| "Good morning, Dr. …" greeting | Reject | WEB-M2-009 | Depends on the visitor's clock; neutral heading and account notice |
| Checklist with progress bar and "n of m complete" | Build | WEB-M2-009 | Real WEB-M1-015 steps; the optional photo is not counted; state badges |
| Mockup "Contact" step | Reject | WEB-M2-009 | No backing data |
| "Submit for review" with disabled state | Reject | WEB-M2-009 | Review starts when the workspace is created. "Resubmit for review" exists only after a rejection, and the publication page explains missing parts in text |
| "Preview public profile" | Build | WEB-M2-009 | On the overview, only while published; uses the profile slug already read |
| Requests table, confirm and decline, waiting badge | M2 | WEB-M2-006 | Server forms with revision checks |
| "Undo", missing "propose another time" | M2 | WEB-M2-001 | Undo removed from the mockup |
| Calendar view | API / Deferred | Decision 7 | Needs availability data; out of Milestone 2 |

### Admin (`Admin.dc.html`)

| Mockup element | Final class | Owner / task | Note |
|---|---|---|---|
| Dark admin header with "ADMIN" label | Reject | Decision 6 | Shared top header and "Administration" link list |
| Status filters | Build | WEB-M2-009 | Already links (`?state=`); restyled as a pill group |
| Queue and detail side by side | Reject | WEB-M2-009 | Separate routes; no route change in this task |
| Reviewer check toggles | Reject | WEB-M2-009 | Client-only state with no stored result |
| "Changes in this submission" | API | API owner | No change summary in the client |
| "Audit log" navigation | API | API owner | No capability |
| "Preview" | API | API owner | No admin review response carries the public slug |
| Approve, reject, suspend actions | Done | WEB-M1 | Server-rendered confirmation pages; unchanged |

### Cross-cutting

| Item | Final class | Note |
|---|---|---|
| Focus ring `#93C5FD` (below 3:1) | Build | `#1d4ed8` (`--color-focus`) in every mockup |
| Language switch and filters as buttons with client state | Build | Links or form controls in every mockup |
| Animations | Build | Wrapped in `prefers-reduced-motion: no-preference` |
| Hard-coded slate and blue colours | Build | Replaced with token values |
