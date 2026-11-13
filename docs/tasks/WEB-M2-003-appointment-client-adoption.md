# WEB-M2-003: Adopt a published API client with appointment-request capability

- **Status:** BLOCKED (drafted 2026-11-13) — no published client contains appointment-request methods; API Milestone 2 tasks do not exist yet
- **Target repository:** `professional-services-medical-web`
- **Depends on:** A published client release from API Milestone 2; explicit owner approval of the exact version; WEB-M1-016 merged or its client upgrade otherwise reconciled
- **Related ADRs:** WEB-ADR-0002, WEB-ADR-0005
- **Cross-repository dependency:** API Milestone 2 tasks, to be linked here when created (see [Milestone 2](../backlog/milestone-2.md#api-work-to-request))
- **Risk:** Medium

## Goal

The exact published contract for appointment requests is pinned and its capabilities are recorded before dependent integrations start.

## Context (2026-11-13)

`package.json` and the lock file pin 0.7.0 on `main` and WEB-M1-019. WEB-M1-016 moves to 0.9.0 on an unmerged branch. Neither version has appointment-request, consent, signed-link, proposal or provider-decision methods.

## Allowed scope

- `package.json` and `package-lock.json` together, adapter and test-fixture adjustments required by changed generated types, and the capability matrix in this file.

## Non-goals

- No feature UI, routes or new API wrappers for appointment requests (WEB-M2-004 to 007).
- No local tarballs, copied generated source or handwritten DTOs. No other dependency change.

## Requirements

1. Follow "Explicit client upgrades" in `README.md`. Verify the version exists in the registry and record its integrity hash and the API release that produced it.
2. Record a capability matrix: API task, generated methods and models, web consumer task. Note for each of submission, signed-link status and cancellation, provider list and decisions, and proposal response whether it is present.
3. Record contract observations the consumers need: validation error shape, rate-limit and abuse responses, expiry and already-used signed-link responses, revision or concurrency fields, and how the visitor address is conveyed (WEB-M2-001 decision 7). Gaps are requests to the API owner, not workarounds.
4. Keep existing wrappers and tests passing. Changed required fields are fixed in synthetic fixtures, not by loosening types.
5. This task may be amended for incremental releases; each consumer is gated only on its own capability.

## Acceptance criteria

- [ ] One approved exact version is installed reproducibly and passes the version policy.
- [ ] The capability matrix and contract observations are recorded; absent capabilities are listed as linked API blockers.
- [ ] Lint, types, unit tests, production build, browser tests and policy tests pass.

## Verification

```powershell
npm ci
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

**Local:** With a compatible local API, `npm run dev` and check `/system-status`, sign-in and one provider page for regressions. **Non-production VPS:** when authorized and the compatible API is deployed first, run the `Deploy web` workflow with the full commit SHA and check `/healthz`, `/system-status` and `/api/v1/system/status`.

## Security and privacy

A client upgrade is an ask-first change. No registry token in source, logs or chat.

## Handoff

Follow AGENTS.md final-response limits and Verify block. State the exact client version and every missing capability.
