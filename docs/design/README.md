# Medical Web — UX design mockups

Interactive design mockups for the medical web product, derived from [`build-plan.md`](../../build-plan.md). They are a **visual reference** for WEB tasks, not production code: the real implementation uses Next.js App Router, Tailwind and the source-owned component set.

- **Live canvas (private, shareable from its Share menu):** https://claude.ai/artifact/MhQPtGrpGDW9VosgBZ5mEA
- **Snapshot date:** 2026-11-13. The online canvas may be newer than these files.

## Screens

| File | Screen | Proposed route |
|---|---|---|
| `Doctors.dc.html` | Doctors directory: search by name, specialty and city | `/[locale]/doctors` (filters as query params, SSR) |
| `Main.dc.html` | Public doctor profile: services, credentials, locations | `/[locale]/doctors/[slug]` |
| `Request.dc.html` | Appointment request: minimal contact, consent, confirmation | Milestone 2 request flow |
| `Provider.dc.html` | Provider dashboard: profile checklist, request list | `/[locale]/provider` |
| `ProviderCalendar.dc.html` | Provider requests, weekly calendar view (waiting and confirmed) | `/[locale]/provider` (calendar view) |
| `Admin.dc.html` | Admin profile review and approval | `/[locale]/admin` |

`canvas.json` holds the canvas layout.

## Notes

- Style follows the approved neutral blue/teal direction with system fonts (WEB-M1-001). Final brand assets and design tokens are still deferred.
- Doctor, visitor, credential and price values are `[placeholders]`. Specialty and city lists are examples; real values come from the API.
- `doctors` directory listing and the calendar view are design proposals, not yet backed by WEB tasks or API capabilities. Raise linked API tasks before implementing them.
- The `.dc.html` files use the Claude design-canvas format and need its runtime (`support.js`) to render. Open the live canvas link to view or edit them.
