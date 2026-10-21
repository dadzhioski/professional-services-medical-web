# WEB-M1-013: Add a localized entry page and global site navigation

- **Status:** PLANNED (2026-10-21); owner decisions below block final copy and branding, not the structural implementation
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-002, WEB-M1-003, WEB-M1-005; owner decisions listed below
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (accepted for identity/session and PUBLIC_ORIGIN)
- **Cross-repository dependency:** None. Uses the identity methods already in pinned client 0.3.0 through `src/lib/api/identity.ts`; no new API capability is required.
- **Risk:** Medium

## Goal

A visitor to `/[locale]` sees a real localized entry page and a site header from which a doctor can reach sign-in, and a signed-in doctor can reach the workspace or sign out, without typing a URL.

## Context (2026-10-21)

The non-production deployment showed no natural way to navigate, sign in or sign up. The localized home page (`src/components/home.tsx`) is still the Milestone 0 neutral development page, the `SiteShell` header shows only `app.title`, and the only sign-in entry is the "Continue with Google" link on `/[locale]/provider`, reachable only by typing that URL. The provider pages have their own provider navigation once signed in. No earlier Milestone 1 task plans a site header, a real entry page or global sign-in navigation.

## Allowed scope

- Replace the development entry page in `src/components/home.tsx` and the `home.*`, `app.*` and `footer.notice` keys it and the shell use.
- Add a site header to `src/components/site-shell.tsx` (and the localized layout that renders it) with the product name, a doctor entry point and a signed-in state.
- Reuse the existing `currentAccount` wrapper and `logout` server action; no new API wrapper unless required by an existing method.
- Typed translation keys in all four locales (mk, en, bg, sq), unit tests and existing Playwright fixture updates for this task's requirements; no unrelated refactor.

## Non-goals

- No directory, search, doctor listing or links to public profiles (WEB-M1-011 and the excluded directory scope).
- No appointment requests, patient accounts, analytics, cookies, tracking, external fonts or scripts, and no new dependencies.
- No administrator navigation (WEB-M1-010), no change to provider workspace navigation beyond linking to it.
- No change to the Google login return allowlist, session/CSRF transport, cookie names or attributes, `PUBLIC_ORIGIN` handling, Caddy, CI or deployment.
- No invented product name, logo, tagline, legal copy or marketing claims; no change to robots/indexing of localized pages (SEO belongs to WEB-M1-011).
- No API source, OpenAPI generation, database work, API deployment, pushing or pull requests.

## Open owner decisions

These are recorded for the owner, not decided by this task. Implementation may proceed with neutral placeholders that keep the current behavior; the acceptance criteria marked "owner" stay open until the decision is recorded here.

1. **Product name and branding.** The deployed domain (`mojdoktor.info`) suggests "mojdoktor", but [WEB-M1-001](WEB-M1-001-experience-and-security-decisions.md#experience-and-route-map) forbids an invented brand or logo. Until the owner decides the name, its spelling per locale and whether any logo or wordmark is used, keep `app.title` as the header name.
2. **Patient-facing entry content.** Public profiles (WEB-M1-011) are not live, so the entry page cannot link to doctors. The owner decides what the page says to patients now (for example, a short neutral description of the service with no promise of search or booking) and whether the page is mainly a doctor entry until profiles are published.
3. **Header entry wording.** The owner decides whether public pages show a generic "Sign in" action, only a "For doctors" link, or both. Google sign-in creates the account on first use, so sign-in and sign-up are the same flow; the decision is about wording and audience, not two flows.

## Requirements

1. The header in `SiteShell` contains, in this order: the product name linking to `/[locale]`, a labelled primary navigation landmark, and the account entry. It renders on every localized page; operational routes (`/healthz`, `/system-status`) are unchanged.
2. Signed-out state: the account entry links to `/[locale]/provider` (the existing sign-in page with "Continue with Google"). The header does not link straight to the Google login path, so the localized return allowlist from WEB-M1-003 is unchanged.
3. Signed-in state: derived server-side with the existing `currentAccount` wrapper and session-cookie helpers, exactly as `/[locale]/provider` does. When the state is `authenticated`, show a link to the provider workspace `/[locale]/provider` and a sign-out control that posts to the existing `logout` server action through a plain form. Show no email, account identifier or other personal data.
4. Any other identity state (`signedOut`, `expired`, `forbidden`, `unavailable`) renders the signed-out entry. A header identity failure never fails, blanks or delays the page content beyond the existing request, and never renders raw API errors.
5. No API call is made when no session cookie is present (the current `currentAccount` behavior). Pages that render the signed-in header stay dynamic and private: no static generation, shared caching or ISR of output that contains account state.
6. Replace the development entry page: remove the "development page / foundation ready" copy and the development `footer.notice`, and render the entry content approved under owner decision 2. The page keeps the language links with path preservation from WEB-M1-002, one `h1`, and a clear doctor call to action to `/[locale]/provider`. The footer keeps a short notice that no patient medical information is collected.
7. Pages and layouts remain Server Components and work with JavaScript disabled, including navigation and sign-out. No Client Component is added unless a requirement cannot be met otherwise.
8. Accessibility: existing skip link remains first and targets `#main-content`; header uses `<header>` and a labelled `<nav>`; the current page link has `aria-current="page"`; visible focus; touch targets at least 44 px; usable at 320 px width; no new axe violations.
9. All user-visible text and metadata use typed keys with complete mk, en, bg and sq dictionaries. Provider-authored content is not involved.
10. Tests: server-rendered output of the entry page and header in signed-out, signed-in and identity-failure states (mocked transport, synthetic configuration); no account data in markup; sign-out form targets the existing action; Playwright checks of header navigation, JavaScript-disabled navigation and axe on `/mk` and one other locale, using the existing fixture.
11. Read [Milestone 1](../backlog/milestone-1.md) and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.

## Acceptance criteria

- [ ] From `/[locale]` a signed-out visitor reaches the Google sign-in page in one click from the header and one from the entry page.
- [ ] A signed-in doctor sees a workspace link and a working sign-out in the header on every localized page; after sign-out the header shows the signed-out entry.
- [ ] Identity unavailable, expired and forbidden states render the signed-out entry with the page intact.
- [ ] No development copy remains on the entry page or footer; all four locales have complete keys.
- [ ] Pages are server-rendered and usable without JavaScript; keyboard and axe checks pass.
- [ ] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; the pinned client is unchanged.
- [ ] (owner) Product name and branding recorded in this task.
- [ ] (owner) Patient-facing entry content recorded in this task.
- [ ] (owner) Header entry wording recorded in this task.
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

**Local:** Start `npm run dev` with existing local API configuration. Open `http://localhost:3000/mk`, follow the header entry to the sign-in page, sign in with a test Google account, and check that the header on `/mk`, `/en` and `/mk/provider/profile` shows the workspace link and sign-out. Sign out and check the signed-out header. Repeat with JavaScript disabled, and with the API stopped (expect the signed-out entry and an intact page).

**Non-production VPS:** When separately authorized, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, with the published full commit-SHA release. Open the site origin, repeat the local navigation and sign-out checks with a synthetic account, and check `/healthz` and `/system-status` for regressions. Record the release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

The header reads the existing API-owned session cookie server-side only; no new cookies, environment variables, client props carrying server configuration, or browser calls to the API. Output containing account state must not be cached or shared between users. No email, account identifier, session or CSRF value appears in markup or logs. Sign-out reuses the existing origin- and CSRF-checked action. Only professional and neutral service content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks, open owner decisions and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.
