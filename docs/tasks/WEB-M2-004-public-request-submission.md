# WEB-M2-004: Let a visitor submit an appointment request from a public profile

- **Status:** BLOCKED (drafted 2026-11-13) on WEB-M2-001 decisions and the submission capability in WEB-M2-003
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-001 (decisions 2, 3, 4, 7, 8, 9); WEB-M2-002; WEB-M2-003 submission capability
- **Related ADRs:** WEB-ADR-0001, [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md); WEB-ADR-0007 (must be accepted for the parts this task implements)
- **Cross-repository dependency:** API Milestone 2 submission, consent and rate-limit task(s), to be linked when created
- **Risk:** High

## Goal

An anonymous visitor opens a published doctor's profile, submits a minimal request with consent and sees a confirmation, without an account and without JavaScript.

## Allowed scope

- Route `src/app/[locale]/doctors/[slug]/request/page.tsx` (path per WEB-M2-001 decision 4) and a Server Action in `src/features/appointment-request/`.
- A server-only anonymous wrapper `src/lib/api/appointment-requests.ts` next to the public wrappers.
- A request link on the public profile page per decision 9; the bare-path redirect in `src/app/(operational)/doctors/[[...path]]/page.tsx` if it needs to cover the new route.
- Typed translation keys in four locales, unit tests, and new routes in `tests/e2e/api-fixture.mjs`.

## Non-goals

- No signed-link pages, provider pages or proposal handling (WEB-M2-005 to 007).
- No patient account, calendar, availability, payment, CAPTCHA, analytics, cookie or third-party script.
- No Caddy, CI or deployment change. If decision 7 needs an edge change, stop and ask; only one task at a time may change Caddy.

## Requirements

1. The form page reads the public profile with the existing anonymous wrapper. A doctor who is not published, or does not accept requests, gets not-found or the agreed safe state; the form never renders for them. Service and location choices come only from the published profile.
2. Submission uses only generated request and response types through the server-only wrapper, with result states such as `accepted | invalid | limited | unavailable`. No visitor cookie is forwarded, nothing is cached, and the wrapper refuses `Set-Cookie` like the other public wrappers.
3. The Server Action validates the request Origin against `PUBLIC_ORIGIN`, trims and length-checks input for usability, and requires consent. The API remains the authority; API validation codes map to translated field errors, and unknown codes map to one generic message.
4. The visitor address reaches the API only in the way WEB-M2-001 decision 7 and the accepted ADR describe. No other header is forwarded and no client-supplied forwarding header is trusted.
5. Abuse checks per decision 8 run server-side. A triggered honeypot gets the same confirmation as a real submission and sends nothing to the API.
6. Success renders the confirmation panel with no personal data in the URL, and a refresh or back navigation cannot resubmit. Rate-limited, invalid and unavailable outcomes render translated states and keep entered values where safe.
7. The form page is `noindex, follow` with a canonical to the profile, and is `no-store`. The profile page's own metadata and structured data are unchanged apart from the new link.
8. Nothing entered by the visitor is logged by the web. Raw API errors and internal URLs are never rendered.
9. Tests:
   - Wrapper: exact request, no cookie, `no-store`, each status mapped, malformed response, timeout, `Set-Cookie` refusal.
   - Action: Origin failure, missing consent, each validation path, honeypot, rate limit, outage, no resubmission.
   - Page SSR in every locale: form, unpublished doctor, each outcome, metadata, axe.
   - Playwright with the fixture: full submission with JavaScript disabled, keyboard only, desktop and Pixel 7, 320 px; no contact data in any URL or in rendered HTML after confirmation beyond what the decisions allow.

## Acceptance criteria

- [ ] A visitor reaches the form in one click from a published profile and can submit it without JavaScript.
- [ ] Consent is required and the request is refused without it.
- [ ] Invalid, rate-limited and unavailable outcomes are safe, translated and accessible.
- [ ] No field or copy solicits detailed medical data; no visitor data appears in URLs or web logs.
- [ ] Lint, types, unit tests, production build, browser tests and API-client policy pass.
- [ ] Human review of the Origin check, the forwarded-address handling and the environment boundary is recorded.

## Verification

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
$env:PUBLIC_ORIGIN = 'http://localhost:3000'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run test:policy
npm run e2e
git diff --check
```

**Local:** With a compatible local API and one published synthetic doctor, `npm run dev`, open `/mk/doctors/<slug>`, follow the request link, submit with and without consent, then with JavaScript disabled; stop the API and submit again (expect the unavailable message). **Non-production VPS:** when authorized and the compatible API is deployed, run `Deploy web` with the full SHA, repeat the submission with synthetic contact data and confirm the Caddy access log holds no request data.

## Security and privacy

First collection of visitor personal data in this product. Consent wording, the field set, forwarded-address trust and logging are approval-gated by WEB-M2-001 and WEB-ADR-0007. Use synthetic contact data in every test and check.

## Handoff

Follow AGENTS.md final-response limits and Verify block. Report unexecuted live checks and any contract gap sent to the API owner.
