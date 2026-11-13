# WEB-M1-019: Visual refresh to a calm healthcare-marketplace look with our own palette

- **Status:** APPROVED (drafted 2026-11-02; owner decisions 1–5 recorded 2026-11-05)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-002 (shared UI), WEB-M1-014 (directory), WEB-M1-017 (price list, touches `presentation.tsx`) and WEB-M1-018 (header rework) merged first, so the restyle starts from their final markup
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md); the WEB-M1-001 experience decision "neutral blue/teal medical presentation, system fonts, accessible contrast, no invented brand/logo or external font"
- **Cross-repository dependency:** None. Purely presentational; no new data. Ratings/reviews are not in pinned client 0.7.0 and are out of scope.
- **Risk:** Medium (touches every page's appearance; no behavior change)

## Goal

Public and provider pages share one visual language in the style of established doctor-booking marketplaces (reference: www.doctify.com): airy layout, soft tinted page background, white rounded cards with soft shadows, large friendly headings, a prominent pill-shaped directory filter/CTA area and clear doctor cards. Colours, logo, imagery and copy are our own.

## Context (2026-11-02)

Styling today is ad hoc Tailwind 4 utilities (`@import "tailwindcss"` only, no `@theme` tokens) with `teal-950`, `teal-800`, `slate-300`, `blue-800` and `red-800` repeated across `src/components/ui/*`, `src/components/site-*.tsx` and feature components. `body` uses `Arial, Helvetica, sans-serif`. Cards are `rounded-xl border border-slate-300 bg-white` with no shadow; the page background is white.

### Reference traits observed on www.doctify.com (2026-11-02, UK home page)

Use these as *proportions and patterns*, not values to copy.

| Area | Observed trait |
|---|---|
| Page | Very light tinted background (near-white blue), white content cards on top; large hero with a soft radial glow behind the search bar |
| Typography | One geometric sans family. `h1` 36 px / 48 px line height, weight 500 (medium, not bold), dark navy; one word of the `h1` in the accent colour. `h2` 24–30 px / 32–40 px, weight 400–500; `h3` 18 px / 26 px; body 14–15 px / 21–24 px in dark slate (not pure black) |
| Header | Slim full-width bar: logo left, "For providers" text link and an outlined pill "Provider login" button right |
| Search / CTA | Single wide pill input (radius ~40 px, 1 px tinted border, large diffuse coloured shadow), placeholder "Start your search…", centred under the hero heading |
| Buttons | Primary/secondary as pills (radius ~20 px, 8 px × 24 px padding, 40–42 px tall, weight 500); outlined variant with 1 px border; very subtle `0 1px 2px` shadow |
| Filter chips | Pill toggles (radius 50 px, 32 px tall); selected state = light tint fill + tinted border, unselected = transparent |
| Cards | White, rounded, soft low-contrast shadow; provider cards: avatar, name, specialty, star rating with count, short location line |
| Footer | Large multi-column link footer, 14 px text, on a contrasting dark band |

### Reference frontend stack (for information only — not adopted)

Next.js 15 (Pages Router: `__NEXT_DATA__`, `/_next/static/` chunks built with Turbopack), React, MUI (Material UI) components styled with Emotion (`muiltr-*` classes), plus vanilla-extract for theme classes; Poppins web font; no Tailwind. Served through nginx behind CloudFront. We keep our own stack (Next.js App Router, Tailwind 4, source-owned components); this task adds no MUI, Emotion, CSS-in-JS or web font.

## Owner decisions needed

1. **Palette.** Approve the proposed token palette below (or supply another). It deliberately stays in the WEB-M1-001 teal family and avoids the reference's navy/royal-blue brand colours.
2. **Font.** Keep system fonts (WEB-M1-001; default), or approve a self-hosted open-licence variable font under `public/` (no external font host). A self-hosted font is a new static asset and needs explicit approval.
3. **Hero on the directory.** Approve a hero band (large heading + subtitle + the existing specialty/city filter restyled as one pill control) at the top of `/[locale]/doctors`. New heading/subtitle copy needs translations in mk, en, bg, sq.
4. **Footer.** Keep the single-notice footer restyled on a dark band (default), or approve a multi-column footer (requires new pages/links, otherwise out of scope).
5. **Wordmark.** Text wordmark with the product name in token colours (default); no logo image unless the owner supplies one.

### Owner decisions recorded (2026-11-05)

1. **Palette:** the proposed palette below is approved; values change only where a contrast check fails, and each change is recorded here.
2. **Font:** system font stack; no web font.
3. **Directory hero:** approved, with new heading (lead + highlighted word as separate keys) and subtitle copy in mk, en, bg and sq.
4. **Footer:** the single-notice footer on a dark `--color-ink` band.
5. **Wordmark:** text wordmark in token colours; no logo image.

**Contrast deviation (implementation, 2026-11-05):** `--color-border` (`#c9dedb`) is 1.40:1 on white, below the 3:1 minimum for UI component boundaries. It stays the decorative card/table border; inputs, selects and the outlined button use an added `--color-control` token (`#4f6665`, the muted value, 6.14:1 on white). `--color-accent` is 4.20:1 on the canvas, so it is used only for the large hero highlight word (3:1 rule; 3.85:1 on the tint behind it). Added tokens: `--color-control`, `--color-danger-strong` (`#8a1a12`), `--color-danger-tint` (`#fdeeec`) and `--shadow-button`.

**Layout deviations (implementation, 2026-11-05):** the profile header card shows photo, name and a one-line specialty summary; locations stay in their own section card directly below, because they are multi-line addresses. The directory grid is 1 column below 640 px and 2 from 640 px; the WEB-M1-018 `max-w-3xl` shared column leaves no room for 3. `directory.heading` and `directory.intro` were replaced by the approved `directory.hero*` keys.

### Proposed palette (approved 2026-11-05; contrast-checked in implementation)

| Token | Role | Proposed value |
|---|---|---|
| `--color-canvas` | page background | `#f3f8f7` |
| `--color-surface` | cards, inputs | `#ffffff` |
| `--color-ink` | headings | `#0b3b3a` |
| `--color-text` | body text | `#29403f` |
| `--color-muted` | hints, secondary text | `#4f6665` |
| `--color-primary` | primary buttons, links | `#0d6e6b` |
| `--color-primary-strong` | hover/pressed | `#0a5654` |
| `--color-accent` | heading highlight word, small accents | `#c2553d` (warm coral; decorative and large text only unless AA verified) |
| `--color-tint` | selected chips, notices | `#dff1ee` |
| `--color-border` | card/input borders | `#c9dedb` |
| `--color-danger` | errors | `#b42318` |
| `--color-focus` | focus ring | `#1d4ed8` (unchanged) |

Radii: `--radius-card` 16 px, `--radius-pill` 9999 px, `--radius-input` 12 px. Shadows: `--shadow-card` soft (e.g. `0 1px 2px rgb(0 0 0 / .04), 0 8px 24px rgb(13 110 107 / .08)`), `--shadow-hero` large diffuse tint around the hero filter.

## Allowed scope

- `src/app/globals.css`: Tailwind 4 `@theme` tokens (colours, radii, shadows, font stack, type scale) and base element styles. No `tailwind.config.*` is needed in Tailwind 4.
- `src/components/ui/*` (`Heading`, `Section`, `Notice`, `Button`, fields, `Surface`): restyle via tokens; add `variant` props only where needed (primary / secondary-outline / chip). Keep exported APIs backwards compatible.
- `src/components/site-header.tsx`, `src/components/site-shell.tsx` (header, footer, skip link, language links) — styling only on top of WEB-M1-018's structure.
- Public pages: `/[locale]/doctors` (hero, filter, doctor cards) and `/[locale]/doctors/[slug]` (profile header card, sections, price list) and their feature components.
- Provider and admin pages: token-based restyle only through shared primitives and replacement of hard-coded colour utilities with token utilities; no layout redesign.
- Not-found and unavailable states.
- Typed translation keys in mk, en, bg, sq only for decision 3 copy, if approved.
- Unit tests where class-dependent assertions break; Playwright visual/axe/responsive checks.

## Non-goals

- No MUI, Emotion, vanilla-extract, other UI framework, CSS-in-JS, icon library or new npm dependency.
- No external fonts, images, CDNs, analytics or third-party scripts.
- No Doctify (or any other company's) colours, logo, imagery, illustrations, icons, copy or layout copied pixel-for-pixel; nothing that could be mistaken for that brand.
- No ratings, reviews, booking, free-text search, maps or new data fields (not in client 0.7.0; reviews would need an API task and owner decision).
- No change to routes, metadata/SEO, i18n wording (beyond decision 3), server actions, API wrappers, session/CSRF, Caddy, CI or deployment.
- No dark mode.
- No new Client Components; no behaviour that requires JavaScript.

## Requirements

1. All colours, radii and shadows used by `src/components` and `src/features` come from the `@theme` tokens; hard-coded palette utilities (`teal-*`, `slate-*`, `blue-*`, `red-*`) are removed from those directories (a grep check in the verification proves it).
2. Type scale: page `h1` 32 px mobile / 40 px ≥ `sm`, weight 600 at most, line height ≤ 1.25; section `h2` 22–24 px; body 16 px / 1.5 (do not go below 16 px for body text). Headings in `--color-ink`, body in `--color-text`.
3. Layout: page background `--color-canvas`; content in white cards with `--radius-card` and `--shadow-card`; vertical rhythm ≥ 24 px between cards, ≥ 24 px inner padding (32 px ≥ `sm`). Container widths follow WEB-M1-018 (header, main, footer share one container).
4. Buttons: primary = filled `--color-primary` pill; secondary = outlined pill; both ≥ 44 px tall, weight 600, visible hover and focus states. Links are underlined or otherwise distinguishable without colour.
5. Inputs and selects: `--radius-input`, 1 px `--color-border`, ≥ 44 px tall, visible focus ring, error state uses `--color-danger` plus text (not colour alone).
6. Directory: if decision 3 is approved, a hero band with the `h1` (optionally one highlighted word via a separate translated span, never by splitting a translated string in code) and the specialty/city filter as one pill-shaped server-rendered `form` with a primary submit. Doctor results render as cards (photo or initials placeholder, name, specialty, city) in a responsive grid (1 column < 640 px, 2 ≥ 640 px, 3 ≥ 1024 px if the container allows).
7. Public profile: a header card (photo, name, specialty, locations) followed by section cards; the price list keeps WEB-M1-017's table semantics and note.
8. Footer on a dark `--color-ink` band with AA-contrast text.
9. Accessibility: every text/background pair meets WCAG 2.2 AA (4.5:1 normal text, 3:1 large text and UI component boundaries/focus indicators); record the computed ratios for each token pair in the handoff. Focus remains visible on all backgrounds; no information by colour alone; respects `prefers-reduced-motion` (no animation beyond simple hover transitions). No new axe violations.
10. Responsive: no horizontal scroll at 320 px; checked at 320, 375, 768 and 1280 px.
11. SSR unchanged: pages remain Server Components, public pages render fully with JavaScript disabled, no new `"use client"` files, no change to metadata or `lang`/`hreflang`.
12. i18n: existing mk, en, bg, sq strings are untouched; long Macedonian/Albanian strings wrap without overflow in buttons, chips and cards.

## Acceptance criteria

- [ ] (owner) Decisions 1–5 recorded in this task.
- [ ] Tokens defined once in `globals.css`; no hard-coded palette utilities remain in `src/components` or `src/features`.
- [ ] Directory and public profile show the card-based, airy layout; provider and admin pages use the same tokens and primitives.
- [ ] Contrast ratios for every token pair recorded and ≥ AA; keyboard, axe, JavaScript-disabled and 320 px checks pass in all four locales.
- [ ] No new dependency, font host, Client Component or API call; pinned client unchanged.
- [ ] Nothing in the result reuses another brand's colours, logo, imagery or copy.
- [ ] Lint, types, unit tests, production build, affected browser checks and API-client policy pass.
- [ ] No deferred Milestone 0 obligation is marked passed or waived.

## Verification

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run e2e
git grep -nE "(text|bg|border|ring|outline)-(teal|slate|blue|red|gray|sky)-[0-9]+" -- src/components src/features
git diff --check
```

The `git grep` must return nothing.

**Local:** `npm run dev`, then open `/mk/doctors`, a published `/mk/doctors/<slug>`, `/en/provider` and `/en/admin` at 320 px and 1280 px; repeat the directory and profile with JavaScript disabled.

**Non-production VPS:** deploy with the `Deploy web` workflow (full SHA) and repeat the directory and profile checks through the site address; no edge checks needed (no Caddy/deployment change).

## Security and privacy

No impact expected: no new data, requests, cookies, scripts, fonts from external hosts or environment variables. A self-hosted font (decision 2) is a static asset served by the web container only. No content imitates another organization.

## Handoff

Report outcome, owner decisions applied, token contrast table, screenshots at 320/1280 px for the directory and profile, checks, SSR/accessibility impact, client version (unchanged), limitations and unexecuted checks.
