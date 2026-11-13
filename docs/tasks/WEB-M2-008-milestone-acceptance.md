# WEB-M2-008: Verify the Milestone 2 visitor-to-doctor request journey

- **Status:** PLANNED (drafted 2026-11-13); waits for WEB-M2-004 through WEB-M2-007
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-004, 005, 006 and, if in scope, 007 implemented; WEB-M2-001 decisions resolved
- **Related ADRs:** WEB-ADR-0002, WEB-ADR-0005; WEB-ADR-0007
- **Cross-repository dependency:** The API Milestone 2 acceptance task, to be linked when created
- **Risk:** High

## Goal

Establish evidence for the complete appointment-request journey and state plainly what was not checked.

## Allowed scope

- One journey spec in `tests/e2e/`, fixture additions it needs, and evidence recorded in this file and in [Milestone 2](../backlog/milestone-2.md).

## Non-goals

- No new feature behavior; defects found are fixed under the task that owns them.
- No production deployment, API operation or closure of Milestone 0 or Milestone 1 obligations.

## Requirements

1. One Playwright journey on desktop and mobile Chromium using only the web UI and the synthetic fixture: published profile → request with consent → confirmation → signed status link → doctor confirms → visitor sees confirmed → visitor cancels; and a second pass through decline and, if in scope, propose and accept.
2. Failure cases: missing consent, invalid input, rate limit, honeypot, expired and tampered links, a `GET`-only link visit, stale provider decision, cross-doctor access, expired session, CSRF refusal, and API outage on each page.
3. Public and signed-link pages work with JavaScript disabled, by keyboard, at 320 px, with no axe violations, in all four locales.
4. Privacy checks: no visitor contact data or token in any URL other than the signed link itself, in page metadata, in web output logs or in the Caddy access log; signed-link pages are `noindex` and `no-store`; no form solicits detailed medical data.
5. Run every gate, including `security:dependencies`, `security:secrets`, the image and edge scans and the edge integration harness. An expired exception or unavailable scanner is a failure, not a pass.
6. Record web commit, exact client version, API version, and separate fixture results from real API, real email delivery and non-production results. Unavailable checks are listed as unexecuted.

## Acceptance criteria

- [ ] The journey and the failure cases pass with synthetic fixtures.
- [ ] Privacy and signed-link checks pass at the web and at the edge.
- [ ] Real API, email and VPS checks are individually evidenced or marked unexecuted.
- [ ] All gates pass, or each failure is reported with the release it blocks.
- [ ] Owner review is recorded; earlier milestones' open obligations are not marked passed.

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
npm run security:dependencies
npm run e2e
make security-check
make image
make image-smoke-test
make container-scan
make edge-image
make edge-container-scan
make integration-test
make integration-down
git diff --check
```

**Local:** Run the journey spec; for a live pass use a compatible local API with its mail capture and synthetic accounts. **Non-production VPS:** when authorized and the compatible API is deployed, run `Deploy web` with the full SHA, repeat the journey with a synthetic mailbox, and inspect the Caddy log for request paths and personal data.

## Security and privacy

Use only synthetic visitors, mailboxes and doctors. Evidence must not contain tokens, contact data or production configuration.

## Handoff

Follow AGENTS.md final-response limits and Verify block. List every unexecuted check.
