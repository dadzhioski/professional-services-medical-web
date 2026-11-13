# WEB-M2-007: Let a visitor accept or decline a proposed time through a signed link

- **Status:** BLOCKED (drafted 2026-11-13) on WEB-M2-005, WEB-M2-006 and the proposal capability in WEB-M2-003; not needed if WEB-M2-001 decision 10 defers proposals
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-001 (decisions 5, 10); WEB-M2-005 (signed-link pages and boundary); WEB-M2-006 (propose action); WEB-M2-003 proposal capability
- **Related ADRs:** WEB-ADR-0001; WEB-ADR-0007
- **Cross-repository dependency:** API Milestone 2 proposal task(s), to be linked when created
- **Risk:** Medium

## Goal

When a doctor proposes another time, the visitor can open the emailed link, see the proposal and accept or decline it.

## Allowed scope

- Extension of the WEB-M2-005 signed-link pages and wrapper with the proposal state and two Server Actions.
- Typed translation keys, unit tests and fixture routes.

## Non-goals

- No counter-proposal by the visitor, negotiation thread, calendar file or reminder.
- No change to the signed-link boundary set in WEB-M2-005; no Caddy change.

## Requirements

1. The status page shows the proposed time from the generated type, formatted for the page locale with the time zone stated in text.
2. Accept and decline are separate `POST` actions with the Origin check; `GET` never answers a proposal. Each has a clear confirmation of the result.
3. An expired, withdrawn or already-answered proposal renders the current state with a translated notice. Answering twice is harmless.
4. The provider detail page from WEB-M2-006 shows the visitor's answer on reload.
5. All WEB-M2-005 token, caching, indexing, referrer and logging rules apply unchanged.
6. Tests: wrapper statuses; actions for accept, decline, stale and outage; SSR in every locale with axe; Playwright with the fixture for propose (doctor) then accept and decline (visitor) with JavaScript disabled, desktop and Pixel 7.

## Acceptance criteria

- [ ] A visitor can accept or decline a proposal without an account or JavaScript, and the doctor sees the result.
- [ ] Stale and repeated answers are safe; visiting the link alone changes nothing.
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
npm run e2e
git diff --check
```

**Local:** With a compatible local API, propose a time as the synthetic doctor, open the visitor link from the local mail capture, accept, then check the doctor's detail page. **Non-production VPS:** when authorized, deploy with `Deploy web` and repeat with a synthetic mailbox.

## Security and privacy

Same signed-link boundary as WEB-M2-005. No new personal data is collected.

## Handoff

Follow AGENTS.md final-response limits and Verify block.
