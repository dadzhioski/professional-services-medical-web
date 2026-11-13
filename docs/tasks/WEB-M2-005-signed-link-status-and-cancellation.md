# WEB-M2-005: Show request status and allow cancellation through a signed email link

- **Status:** BLOCKED (drafted 2026-11-13) on WEB-M2-001 decisions and the signed-link capability in WEB-M2-003
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-001 (decisions 4, 5, 6); WEB-M2-002; WEB-M2-003 signed-link capability
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0004; WEB-ADR-0007 (signed-link boundary must be accepted)
- **Cross-repository dependency:** API Milestone 2 signed-link, cancellation and email task(s), to be linked when created
- **Risk:** High

## Goal

A visitor who opens the link from their email sees the current state of their request and can cancel it, with no account, and the link is not leaked, cached, indexed or triggered by automated link scanners.

## Allowed scope

- Signed-link routes under `src/app/[locale]/requests/` (shape per WEB-M2-001 decisions 4 and 5), a cancel Server Action, and wrapper functions in `src/lib/api/appointment-requests.ts`.
- A bare-path redirect for unprefixed email links if decision 4 calls for it.
- Typed translation keys, unit tests, fixture routes, and an edge integration check for the effective response headers.

## Non-goals

- No proposal response (WEB-M2-007), provider pages, resend-link or lookup-by-email feature, patient account or session cookie.
- No email templates or delivery; the API owns them.
- No Caddy change unless requirement 4 proves one is needed, and then only after asking.

## Requirements

1. `GET` only reads and displays. Cancellation is a separate confirmation step submitted by `POST` through a Server Action with the Origin check. Opening or prefetching the link never changes the request.
2. The token is treated as a credential: validated for shape before any API call, sent to the API only through the generated client, never written to logs, page metadata, canonical or language-alternate links, error messages or links to other pages. Language links on these pages follow decision 5.
3. Pages are `noindex, nofollow`, `no-store`, and send `Referrer-Policy: no-referrer`. They contain no external resources.
4. Verify the header that actually reaches the browser through Caddy with the `make integration-*` harness, because the edge sets its own `Referrer-Policy`. Also confirm the access log for these routes contains no path. If either fails, stop and request an approved Caddy change.
5. The status page shows only what the generated visitor-safe type provides: the doctor's public name, the request state and the times the API returns. It does not repeat the visitor's contact details unless the decisions say so.
6. Invalid, expired, already-used and already-cancelled links, a request that can no longer be cancelled, and an API outage each render a distinct translated state without revealing whether a request exists beyond what the API states. Malformed tokens get the same response as unknown ones.
7. After cancellation the page shows the cancelled state; a refresh does not resubmit and a second cancel is harmless.
8. Tests:
   - Wrapper: exact calls, no cookie, each status mapped, malformed response, timeout.
   - Pages SSR in every locale: each state, metadata and robots, no token in rendered HTML other than the form's own action target, axe.
   - Action: Origin failure, stale state, repeat cancel, outage.
   - Playwright with the fixture: read then cancel with JavaScript disabled, a `GET`-only visit leaves the request unchanged, keyboard only, desktop and Pixel 7, 320 px.
   - Edge integration: effective `Referrer-Policy` and no path in the access log.

## Acceptance criteria

- [ ] A valid link shows the request state; cancelling requires an explicit confirmation and works without JavaScript.
- [ ] Visiting a link, including repeatedly, never changes the request.
- [ ] Tokens do not appear in logs, metadata, outbound links or referrers; pages are not indexed or cached.
- [ ] Expired, used, invalid and unavailable states are safe, translated and accessible.
- [ ] Lint, types, unit tests, production build, browser tests, edge integration checks and API-client policy pass.
- [ ] Human review of the signed-link boundary is recorded.

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
make image
make edge-image
make integration-up
make integration-routing-test
make integration-down
git diff --check
```

**Local:** With a compatible local API, submit a synthetic request, take the link from the API's local mail capture, open it, cancel, and reopen it; alter one character of the token and expect the invalid state. **Non-production VPS:** when authorized, deploy with `Deploy web`, repeat with a synthetic mailbox, and check the Caddy log for the absence of the link path.

## Security and privacy

Signed links are bearer credentials. Referrer policy, logging, caching and `GET` safety are security boundaries that need tests and human review. Run `make integration-down` after any integration run, including failed ones.

## Handoff

Follow AGENTS.md final-response limits and Verify block. Report the observed edge header behavior and any requested Caddy change.
