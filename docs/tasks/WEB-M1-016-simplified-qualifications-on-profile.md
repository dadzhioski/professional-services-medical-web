# WEB-M1-016: Replace credential records with free-text qualifications on the profile page

- **Status:** IMPLEMENTED LOCALLY (2026-11-05) against pinned client 0.9.0, approved by the owner on 2026-11-05 ("new api client is released 0.9.0"); live API and non-production checks pending. Earlier BLOCKED (2026-10-27) on [API-M1-014](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-014-simplified-qualifications.md), now resolved. Owner decisions are recorded below. Drafted from owner feedback that credential entry is too heavy: doctors want to paste their education, specialties and certificates from a CV without date pickers, and proof images should not be needed to publish.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-006 (profile editor), WEB-M1-008 (photo and private evidence), WEB-M1-009 (credentials, superseded by this task), WEB-M1-010 (approval and publication), WEB-M1-011 (public profile), WEB-M1-014 (directory), WEB-M1-015 (onboarding checklist); API-M1-014; an explicitly approved client upgrade (WEB-M1-004 process)
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0002](../adr/WEB-ADR-0002-exact-api-client-version.md) (exact client version); [WEB-ADR-0005](../adr/WEB-ADR-0005-independent-release-compatibility.md) (API deploys additive changes before the web release); [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (private evidence never appears in public output)
- **Cross-repository dependency:** [API-M1-014](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-014-simplified-qualifications.md) (implemented; owner answers A: compatible change with deprecated fields, B: a text change by an approved doctor returns the doctor to review and unpublishes, C: migration never unpublishes) and [API-ADR-0010](../../../../professional-services-platform-api/professional-services-platform-api/docs/adr/API-ADR-0010-publication-requirement-values.md) (new `missing` values approved). Delivered in client 0.9.0 (0.8.0 plus the API-M1-011 corrections). Before it, pinned client 0.7.0 required dated, typed credential records with evidence and an approved credential to publish.
- **Risk:** High

## Goal

A doctor fills in Education, Specialties and Certificates as plain text on the profile page, pasting from a CV if they like, with no date or duration inputs. Proof images are optional, private, and never block publishing. A profile with Education and Specialties filled in can be approved and published without any proof.

## Context (2026-10-27)

Credentials live on `/[locale]/provider/credentials` (`src/app/[locale]/provider/credentials/page.tsx`, `src/features/provider-credentials/*`, `src/lib/api/credentials.ts`). Each credential is a record with a type `<select>`, title, issuer, a required issue date and an optional expiry date (native date pickers). It must have at least one evidence image before it can be submitted (`credentials.evidenceRequired`), and an administrator approves each credential separately (`src/app/[locale]/admin/credentials/*`). Publication requires an approved credential: `APPROVED_CREDENTIAL` in `missing` (`src/features/provider-publication/labels.ts`), and the onboarding checklist has a separate credentials step (`src/features/provider-onboarding/progress.ts`).

The profile page (`src/app/[locale]/provider/profile/page.tsx`) already holds display name, biography, photo and the specialty `<select>` used by the directory filter (WEB-M1-014).

## Owner decisions (2026-10-27)

1. **No dates or durations.** No date pickers, year/month selects or duration inputs anywhere in the qualification entry.
2. **Three free-text sections on the profile page.** Education, Specialties and Certificates are multi-line plain-text fields on the profile page, easy to paste from a CV. The separate credentials page is removed.
3. **Required sections.** Education and Specialties are required before the profile can be published; Certificates is optional.
4. **Proof is optional and private.** Doctors may attach proof images ("nice to have"). The form says clearly that proofs are not publicly visible. Missing proofs never block approval or publishing.
5. **Review.** Publishing needs the doctor's account approval only. The administrator reviews the qualification text and any proofs as part of that approval; there is no separate per-credential approval.
6. **Specialty select stays.** The existing reference specialty `<select>` (directory filter) is unchanged; the Specialties text is additional, descriptive content.

## Required API contract (API-M1-014)

The web must not invent these DTOs; it starts only once a published client contains them.

1. Profile-level plain-text fields `education`, `specialties` and `certificates` in the owner profile read/update (with the existing `version` conflict check), each with an API-defined maximum length and line breaks preserved.
2. `PublicationResponse.missing` gains `EDUCATION` and `SPECIALTIES` (blank text counts as missing) and no longer contains `APPROVED_CREDENTIAL`.
3. Optional owner-only proof images attached to the profile (reusing `CREDENTIAL_EVIDENCE` media and the existing count/size limits), readable by the owner and administrators only, never present in public DTOs, and never required for approval or publication.
4. Public profile DTO exposes the three texts; directory DTOs are unchanged.
5. The administrator doctor-review read includes the three texts and the proof images, so approval covers them.
6. Editing the texts after approval follows the API's existing rule for profile changes after approval (API owner decides and documents it).
7. Existing credential records are migrated into the text fields (or the API owner documents why not), and the old credential endpoints stay available until a web release without them is deployed (WEB-ADR-0005).

## Allowed scope (once unblocked)

- Adoption of the approved client version (`package.json`, lockfile, `check:api-client-version` expectation) per WEB-M1-004.
- `src/app/[locale]/provider/profile/page.tsx` and `src/features/provider-profile`: qualification editor and optional proof section, reusing `ImageInput`, `OwnerImage` and `src/features/media/limits.ts`.
- `src/lib/api` server-only wrappers for the new profile fields and profile proofs; removal of `src/lib/api/credentials.ts` and its tests.
- `/[locale]/provider/credentials` becomes a redirect to the profile page's qualifications section; removal of `src/features/provider-credentials`.
- `src/app/[locale]/admin/credentials/*` removed (redirect to the doctor review list) and `src/app/[locale]/admin/doctors/[organizationId]/page.tsx` shows the texts and proofs.
- `src/features/provider-onboarding/progress.ts`: drop the credentials step and list Education and Specialties under the profile step; `src/features/provider-publication/labels.ts` maps the new missing parts to the profile page.
- `src/features/public-profile/content.ts` and `src/lib/seo/structured-data.ts` for the public texts.
- Typed translation keys in mk, en, bg and sq; removal of keys that become unused (`credential.*`, `credentials.*`, and `evidence.*` where no longer used).
- Unit, page and Playwright tests, including `tests/e2e/credentials.spec.ts` (replaced), `journey.spec.ts`, `onboarding.spec.ts` and `tests/e2e/api-fixture.mjs`.

## Non-goals

- No API repository edits, no hand-written DTOs, no work before the client is published and the upgrade approved.
- No rich text, Markdown, CV file upload or parsing.
- No change to the specialty `<select>`, directory filters, services, locations or photo behaviour.
- No change to sign-in, session/CSRF transport, Caddy, CI or deployment.
- No patient records or detailed medical data.
- No pushing or pull requests unless requested.

## Requirements

1. The profile page has a "Qualifications" section with three labelled `<textarea>` fields (Education, Specialties, Certificates), each with a hint such as "Paste from your CV; one item per line". Education and Specialties are marked required for publishing; Certificates is marked optional. There are no date, year, month or duration inputs.
2. Saving validates on the server: trimmed text within the API maximum length, line breaks kept. A blank Education or Specialties field can be saved as a draft but is reported as missing for publishing. Stale versions show the existing conflict view with the latest values.
3. A "Proof (optional)" section lets the doctor add and remove proof images within the existing limits. It states that proofs are not publicly visible and are only seen by the review team, and that they are not required to publish.
4. `/[locale]/provider/credentials` redirects to the profile page qualifications section for every locale; unsupported locales return not-found. No navigation, checklist or notice links to the removed page.
5. The onboarding checklist has no credentials step; the profile step lists display name, biography, specialty, education and specialties as its parts. The publication page lists `EDUCATION` and `SPECIALTIES` as missing parts linking to the profile page. Unknown `missing` values are never treated as done.
6. The public profile shows Education, Specialties and Certificates (when present) as escaped plain text with line breaks preserved. Proof images, their URLs and IDs never appear in public HTML, metadata, previews or JSON-LD.
7. The administrator doctor review shows the three texts and any proofs; the separate credential review queue is gone.
8. Pages remain Server Components and work with JavaScript disabled; no new Client Component beyond existing form helpers.
9. Accessibility: one `h1`, labelled fields with associated hints and errors, visible focus, 44 px targets, 320 px layout, no new axe violations.
10. All user-visible text and metadata use typed keys with complete mk, en, bg and sq dictionaries.
11. Tests:
    - Field validation and draft mapping unit tests (blank, whitespace, maximum length, line breaks, malicious text).
    - Progress and publication-label unit tests for the new missing parts.
    - Page SSR tests for every locale: empty, partially filled, filled, with and without proofs, conflict, read failure; malicious text stays inert; axe.
    - Public profile tests proving no proof data in HTML or JSON-LD.
    - Playwright with the fixture: fill the three sections by pasting multi-line text, skip proofs, get approved and publish; JavaScript disabled, keyboard and axe, desktop and Pixel 7, 320 px; the journey spec passes end to end.
12. Read [Milestone 1](../backlog/milestone-1.md) and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.

## Acceptance criteria

- [x] (owner) Decisions 1–6 recorded in this task.
- [x] Linked API task created: API-M1-014 (2026-10-27).
- [x] A client version containing API-M1-014 is published and the upgrade is approved (0.9.0; owner instruction 2026-11-05 to continue on the released 0.9.0, recorded in WEB-M1-004).
- [x] Qualifications are entered as three free-text sections on the profile page, with no date or duration inputs.
- [x] Education and Specialties are required to publish; Certificates is optional.
- [x] A profile without any proof images can be approved and published.
- [x] The proof section is labelled optional and says proofs are not publicly visible; no proof data appears in public output.
- [x] The credentials page and the separate credential review are gone, with redirects in place.
- [x] Keyboard, axe, mobile/desktop and 320 px checks pass.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Implementation record (2026-11-05):
- Client pinned to 0.9.0. `/[locale]/provider/credentials` redirects to `/[locale]/provider/profile#qualifications`; `/[locale]/admin/credentials/*` redirects to `/[locale]/admin/doctors`. `src/features/provider-credentials`, `src/lib/api/credentials.ts` and the credential review wrappers and pages are removed, as are the onboarding credentials step and unused `credential*`/`evidence.*` keys.
- The profile page has a Qualifications section (three `<textarea>` fields through the existing `ProfileEditor`, generalized to take its fields) saved with `updateProfileQualifications`, and a "Proof (optional)" section using `replaceProfileEvidence`. The proof list is reread at the shown version, so the browser never supplies it. All forms on the page share the profile version: an editor sends the newer of its own and the re-rendered version (except after a conflict), so saving one form never discards typed text in the other.
- API decision B is shown before saving: an approved doctor is warned that a text change returns the account to review and takes the profile offline. The web predicts nothing; the page rereads the API.
- `EDUCATION` and `SPECIALTIES` link to the qualifications section; the deprecated `APPROVED_CREDENTIAL` and any other unknown part is shown as an unknown missing part, never as done. The public profile shows the three texts as escaped pre-line text; JSON-LD no longer has `hasCredential`. The administrator doctor review shows the texts and proofs (admin media route only).
- Separate review pass done; its findings (policy test pin, input loss from remounts, proof 404 message, upgrade record, section anchor, trimmed length check, redirect tests) are fixed.

Local evidence (2026-11-05): Passed: lint on `src tests scripts next.config.ts`, typecheck, 923 unit tests, 48 policy tests, API-client policy (0.9.0), production build, 262 desktop/mobile browser scenarios and `git diff --check`. Not executed: live API, Google sign-in and non-production VPS checks.

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

**Local:** Use the isolated browser fixture for the scenarios above. For live checks, run `npm run dev` against a local API with the linked API task deployed and a fresh synthetic Google account. Paste multi-line education and specialties from a sample CV, leave certificates and proofs empty, complete the other steps, get approved by a synthetic administrator and publish. Confirm the public profile shows the texts and no proof. Add a proof and confirm it is visible to the owner and administrator only. Repeat with JavaScript disabled.

**Non-production VPS:** When separately authorized and the compatible API is deployed first, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, with the published full commit-SHA release. Repeat the local journey with synthetic accounts and check `/healthz` and `/system-status`. Record the release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

Proof images remain private evidence under WEB-ADR-0006: same-origin, no-store owner and administrator delivery only, never in public HTML, metadata, previews, structured data or logs. Qualification text is provider-authored and rendered as escaped plain text. All reads and writes go through server-only wrappers with the visitor's session. No new data categories beyond professional qualifications; never solicit patient records or detailed medical information. The client upgrade requires explicit approval.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks, open owner decisions and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.
