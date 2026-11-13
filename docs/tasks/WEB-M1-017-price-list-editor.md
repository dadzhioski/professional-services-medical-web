# WEB-M1-017: Replace one-by-one service entry with an informational price list

- **Status:** IMPLEMENTED, NOT DEPLOYED (2026-10-28; separate review pass and its fixes 2026-11-02); local checks pass, live API and VPS checks not run; owner decisions recorded below. Drafted from first-test feedback: patients do not choose services themselves (the doctor decides the procedures at the examination), so adding services one form at a time is slow and the list is only information for patients.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-007 (services and practice locations), WEB-M1-011 (public profile), WEB-M1-015 (onboarding checklist); pinned client 0.7.0, no upgrade
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0002](../adr/WEB-ADR-0002-exact-api-client-version.md) (exact client version); [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md)
- **Cross-repository dependency:** None. Pinned client 0.7.0 `ServicesApi` (list, create, update with `version`, delete) is sufficient. The API allows at most 50 services per organization and 10 locations per service; `PublicationResponse.missing` keeps `SERVICE`, so at least one entry is still needed to publish.
- **Risk:** Medium

## Goal

A doctor maintains their whole price list in one form: one row per entry (name, price, currency, optional description), saved with one button, or pasted as text and reviewed before saving. Patients see a simple price list with a note that prices are indicative and the doctor decides on the procedures needed at the examination.

## Context (2026-10-27)

`/[locale]/provider/services` lists services and offers one add form or one edit form at a time (`src/features/provider-services/*`), each with name, description, a price on/off choice, amount, currency and location checkboxes. Removal uses a separate confirmation step. The public profile lists services as `name — price` lines under "Services".

## Owner decisions (2026-10-27)

1. **Option A, web only.** One price-list form; the server action compares the submitted rows with the API's current list and makes one create, update or delete call per changed row. No API change or client upgrade.
2. **Rename to "Price list"** in provider navigation, onboarding, publication labels and the public profile.
3. **Rows instead of records.** Each row has name, amount and currency; the description is an optional collapsible detail. When the list is empty, the first row is prefilled with a translated "First examination" name; it becomes an entry only once given a price or description, so an untouched suggestion is never saved or imported.
4. **Paste import.** A textarea accepts one entry per line (for example `Abdominal ultrasound – 1500 den`); parsed lines are added as unsaved rows for review, never saved directly.
5. **Locations out of the form.** New entries are linked to all practice locations (API maximum 10); existing entries keep their current links.
6. **No price ranges.** `Price` holds one amount; a doctor writes "from" or a range in the name or description.
7. **Still required to publish.** At least one entry stays required (API `SERVICE` missing part); the onboarding step text says the examination price is enough.
8. **Patient note.** The public price list states that prices are indicative and the doctor decides at the examination which procedures are needed. Entries without a price read "Price on request".

## Allowed scope

- `src/app/[locale]/provider/services/page.tsx` and `src/features/provider-services/*` (price-list editor, row parsing, paste parser, save action).
- `src/features/public-profile/content.ts` and `src/features/professional-profile/presentation.tsx` for the public price list and note.
- Typed translation keys in mk, en, bg and sq; removal of keys that become unused.
- Unit, page and Playwright tests, including `tests/e2e/services.spec.ts`, `journey.spec.ts`, `onboarding.spec.ts` and `publication.spec.ts`.

## Non-goals

- No API repository edits, client upgrade, hand-written DTOs or bulk endpoint.
- No booking, service selection by patients, price ranges or per-location prices.
- No change to locations, credentials, profile, sign-in, Caddy, CI or deployment.
- No patient or detailed medical data.

## Requirements

1. The page shows one form with a row per existing entry plus empty rows (three by default; a server-handled "more rows" submit button shows ten and keeps typed input, so it works without JavaScript), up to the API limit of 50 entries. Each existing row has a "Remove" checkbox.
2. Saving validates every row on the server with the existing bounds (name required and ≤ 120, description ≤ 1000, amount matches the contract pattern, currency required with an amount). Fully empty new rows are ignored. Errors are listed in one summary linking to each field.
3. Only changed rows are sent. Updates use the version the form was rendered with and keep the entry's linked locations from the API. A row changed elsewhere (409) keeps the doctor's input, shows the latest saved value and adopts the latest version, so saving again is an explicit overwrite. A row removed elsewhere is kept as a new entry. Session failures, and an unavailable API, stop processing and keep all input; rows saved before the stop come back with their new version, so saving again is safe.
4. When every change succeeds the page reloads with the saved notice; otherwise saved rows show their saved values and failed rows show their own error.
5. The paste import parses one entry per line: leading bullets and numbering are dropped; a trailing amount with an optional currency (`ден`, `денари`, `MKD`, `EUR`, `€`, `евра`) becomes the price; space or dot thousands separators and comma or dot decimals are accepted. Lines without a price become entries without a price. Imported rows are not saved until the doctor saves. Saving while text remains in the paste box saves nothing and asks the doctor to add or clear it, so the text is never lost.
6. The public profile shows a "Price list" section as a two-column table (entry, price) with the patient note; descriptions appear under the entry name as escaped plain text.
7. Pages remain Server Components and the form works with JavaScript disabled; the editor is the only Client Component and reuses the shared form helpers.
8. Accessibility: one `h1`, every input labelled with its row's name, visible focus, 44 px targets, 320 px layout, no new axe violations.
9. Tests: row parsing, paste parser and change planning unit tests; action tests for create/update/delete ordering, conflicts, removed-elsewhere rows and session failure; page SSR tests in every locale; Playwright for paste-and-save, multi-row edit/remove, conflict, JavaScript disabled, keyboard and axe, 320 px.

## Acceptance criteria

- [x] (owner) Decisions 1–8 recorded in this task.
- [x] A doctor can enter, edit and remove several entries with one save.
- [x] Pasted lines become reviewable rows with parsed prices.
- [x] Conflicts and partial failures keep the doctor's input and show which rows failed.
- [x] The public profile shows the price list with the patient note.
- [x] Keyboard, axe, mobile/desktop and 320 px checks pass.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

## Verification

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

**Local:** Against a local API with a synthetic account, open `/mk/provider/services`, paste a few priced lines, review and save, then edit two rows and remove one in a single save. Open the public profile after publication and confirm the price list and note. Repeat with JavaScript disabled.

**Non-production VPS:** When separately authorized, deploy per `deployment/README.md` and repeat the local journey with synthetic accounts.

## Security and privacy

All reads and writes go through the existing server-only service wrappers with the visitor's session and CSRF bootstrap. Service identifiers and versions returned by the browser are untrusted: only their shape is checked and the API authorizes ownership. Entry text is provider-authored and rendered as escaped plain text. The privacy note about not including patient information stays on the page.
