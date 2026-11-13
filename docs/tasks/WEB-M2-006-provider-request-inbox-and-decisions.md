# WEB-M2-006: Give doctors a request inbox with confirm, decline and propose-another-time

- **Status:** BLOCKED (drafted 2026-11-13) on WEB-M2-001 decisions and the provider capability in WEB-M2-003
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-001 (decisions 4, 10, 11); WEB-M2-002; WEB-M2-003 provider capability; WEB-M1-015 (workspace checklist)
- **Related ADRs:** WEB-ADR-0001, [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (session and CSRF boundary); WEB-ADR-0007
- **Cross-repository dependency:** API Milestone 2 provider-decision task(s) and login return allowlist entries for the new routes, to be linked when created
- **Risk:** Medium

## Goal

A signed-in doctor sees the requests sent to them and can confirm, decline or propose another time, and nobody else can.

## Allowed scope

- Routes `src/app/[locale]/provider/requests/page.tsx` and `…/requests/[requestId]/page.tsx`, a feature under `src/features/provider-requests/`, and a session wrapper `src/lib/api/provider-requests.ts` on the existing session transport.
- A link from the provider workspace and the site header per decision 11; the bare `/provider/...` redirect already covers new provider paths.
- Typed translation keys, unit tests and fixture routes.

## Non-goals

- No calendar, availability, reminders, messaging, export, bulk actions or administrator views.
- No email sending from the web. No change to the session/CSRF transport, the onboarding steps or publication rules.
- If decision 10 defers proposals, the propose action is left out here and added by an amendment.

## Requirements

1. Reads and mutations use only generated types through the existing server-only session transport, with the session cookie and CSRF token handled as in the other provider features. Pages are `no-store` and `noindex`.
2. Signed-out, expired-session, not-onboarded and suspended accounts get the same safe states and sign-in return behavior as the other provider pages. The return destination works only once the API allowlist includes the new routes; until then, sign-in returns to the workspace.
3. The list is server-rendered and paginated with links, newest first or in the API's order, with a filter by state as a plain `GET` form if the contract supports it. Each row shows only what the doctor needs to triage.
4. The detail page shows the visitor's contact details and preferences exactly as the generated type provides and decision 10 permits. All visitor-supplied text is rendered as inert text.
5. Confirm, decline and propose are Server Actions with the Origin check, a confirmation step for decline, and the revision or concurrency field from the contract. A stale decision renders the current state with a translated notice, following `src/features/provider-records/decision-confirmation.tsx`.
6. Decline reasons and proposed times follow decision 10. A proposed time uses native date and time inputs with a no-JavaScript path; the API validates it.
7. A request belonging to another organization renders not-found, never a different error that confirms it exists.
8. Empty, unavailable and forbidden states are translated and accessible. Visitor contact data is never logged or placed in URLs or page titles.
9. Tests:
   - Wrapper: exact calls, cookie and CSRF forwarding, each status mapped, stale revision, timeout.
   - Actions: Origin failure, CSRF refusal, each decision, stale decision, outage.
   - Pages SSR in every locale: list, empty, detail in each state, cross-organization not-found, axe.
   - Playwright with the fixture: a request submitted through WEB-M2-004's fixture route appears in the inbox; each decision; keyboard only; desktop and Pixel 7; 320 px; a second synthetic doctor cannot open the first one's request.

## Acceptance criteria

- [ ] A doctor can list, open and decide requests; each decision is reflected on reload.
- [ ] Stale, expired-session, CSRF-refused and outage cases render safe translated states.
- [ ] Another doctor's request is not readable or changeable.
- [ ] Lint, types, unit tests, production build, browser tests and API-client policy pass.

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

**Local:** With a compatible local API, submit a synthetic request to a published synthetic doctor, sign in as that doctor, open `/mk/provider/requests`, confirm one request and decline another; sign in as a second doctor and expect not-found on the first doctor's request URL. **Non-production VPS:** when authorized, deploy with `Deploy web` and repeat with synthetic accounts.

## Security and privacy

Doctors see visitor personal data here. Tenant isolation is enforced by the API and verified by tests; the web adds no bypass and stores nothing.

## Handoff

Follow AGENTS.md final-response limits and Verify block. Report whether the login return allowlist was available.
