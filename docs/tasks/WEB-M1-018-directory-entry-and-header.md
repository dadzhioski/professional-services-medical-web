# WEB-M1-018: Start the site at the doctor directory and rework the site header

- **Status:** IMPLEMENTED LOCALLY (2026-10-28); signed-in email menu blocked on a linked API task; non-production VPS checks open
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-013, WEB-M1-014
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md)
- **Cross-repository dependency:** Showing the signed-in account's email needs an API task that adds the email to `CurrentAccount` in a published client. Pinned client 0.7.0 exposes only `accountId`, `emailVerified` and `sessionExpiresAt`. Everything else uses existing wrappers.
- **Risk:** Medium

## Goal

A visitor to `/[locale]` lands on the public doctor directory. Every localized page has a header with the product name, language switcher and account entry, aligned with the content column.

## Context (2026-10-28)

The owner reviewed the Macedonian entry page. The entry boxes ("Find a doctor", "For doctors") duplicate the header. The header's "Doctors" link duplicates the product name. The language row sits inside each page's content. The header (`max-w-5xl`) is wider than the content (`max-w-3xl`), so the product name does not line up with the content's left edge.

## Allowed scope

- `src/components/site-header.tsx`, `src/components/site-shell.tsx`, and the removal of `src/components/home.tsx` and its `home.*` keys.
- `src/app/[locale]/page.tsx` and `src/app/(operational)/page.tsx` entry redirects.
- Moving `LanguageLinks` from each localized page's `main` into the header, keeping each page's existing path preservation.
- Typed keys in mk, en, bg, sq; unit and Playwright updates for these requirements.

## Non-goals

- No email, account identifier or other personal data in the header until the linked API task ships and the owner approves showing it (this changes WEB-M1-013's "no email" rule).
- No change to the login return allowlist, session/CSRF transport, cookies, `PUBLIC_ORIGIN`, Caddy, CI or deployment.
- No change to directory content, filters, metadata or indexing rules from WEB-M1-014.
- No new dependency, Client Component, global state or API wrapper.

## Requirements

1. `/[locale]` redirects to `/[locale]/doctors`, and `/` redirects to `/{defaultLocale}/doctors`. The directory stays the only URL serving the listing, so its canonical, alternates and robots rules are unchanged.
2. The entry boxes and `home.*` keys are removed.
3. The header has two rows: the language switcher at the top right, then the product name on the left and the account entry on the right. The product name links to `/[locale]/doctors` with `aria-current="page"` on the directory. The separate "Doctors" link is removed.
4. Signed out (and every non-authenticated identity state): a "For doctors" link and a "Sign in" button-styled link, both to `/[locale]/provider`. Signed in: the workspace link and the existing sign-out form. Until the linked API task ships, the signed-in state shows no email menu.
5. The header, main content and footer share one centered container (`max-w-3xl`, `px-6`), so their left edges line up.
6. The language links keep the page's path, `hreflang`, `lang` and `aria-current`, and are inside a labelled `nav`. Header links and buttons are at least 44 px tall. No horizontal scroll at 320 px. No new axe violations. Everything works without JavaScript.

## Acceptance criteria

- [x] `/mk`, `/en` and `/` land on the localized directory, and the directory metadata is unchanged.
- [x] The header shows languages top right, the product name aligned with the content, and no "Doctors" link.
- [x] Signed out: "Sign in" reaches the Google sign-in page. Signed in: the workspace link and sign-out work without JavaScript.
- [ ] (blocked: API) Signed in: a button showing the account email opens a sign-out action.
- [x] All four locales have complete keys. Lint, types, unit tests, build, affected browser checks and API-client policy pass. The pinned client is unchanged.

## Verification

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run e2e
```

**Local:** Run `npm run dev`. Open `http://localhost:3000/mk` (expect the directory at `/mk/doctors`). Check that the header's product name lines up with the heading, that the language links are top right, and that switching language keeps the page. Sign in from the header, check the workspace link and sign-out, and repeat at 320 px width and with JavaScript disabled.

**Non-production VPS:** Deploy the published full commit SHA with the manual `Deploy web` workflow (non-production), then repeat the local checks on the site origin and check `/healthz`.

## Security and privacy

The header reads the existing session cookie server-side only, and its output stays dynamic and uncached. No account data appears in markup.
