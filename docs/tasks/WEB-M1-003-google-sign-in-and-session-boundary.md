# WEB-M1-003: Integrate Google sign-in and secure server sessions

- **Status:** PLANNED — applicable decisions/approvals from WEB-M1-001 required
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-001 auth decisions; WEB-M1-002
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; decisions recorded by WEB-M1-001 where applicable
- **Cross-repository dependency:** [API-M1-003](../../../../professional-services-platform-api/professional-services-platform-api/docs/tasks/API-M1-003-auth0-sessions.md)
- **Risk:** High

## Goal

Let a provider sign in through the API-owned Google flow and use a private server-rendered account shell.

## Allowed scope

- Web implementation and existing unit/browser fixtures necessary for this task's requirements.
- Relevant typed translations and narrowly required documentation; no unrelated refactor.

## Non-goals

- No API source, OpenAPI generation, database work, API deployment or business-rule implementation.
- No appointment requests, detailed medical data, analytics, directory expansion or unapproved dependencies.
- No production/edge/CI changes, publishing, pushing, pull requests or Milestone 0 acceptance reconstruction.

## Requirements

1. Verify the locked and installed 0.2.0 package actually exposes the observed IdentityApi methods and agrees with the published artifact; a local declaration is not publication or deployed API evidence. Missing methods or a required release block integration until explicitly approved client adoption.
2. Use API-M1-003 Google-only registration/login, same-origin browser navigation and API-owned callback; the web never processes provider tokens. Derive navigation paths through the generated client where supported; do not fetch a redirect intended for browser navigation.
3. Implement narrowly scoped server-only authenticated wrappers for current account, CSRF and logout. Forward only the documented session cookie to the fixed API origin; propagate approved Set-Cookie behavior where required, rejecting unsafe redirects and never forwarding all request headers.
4. Route mutations through web server handlers/actions using the generated client, current session and CSRF contract; protect the web entry point as well as the upstream mutation. Refresh CSRF after login/logout and never share private caching.
5. Render translated signed-out, expired-session, forbidden and unavailable states; logout invalidates the API session. Allow only approved local return destinations.
6. Private routes and metadata are no-store/noindex; login email is not public profile contact data. No email-derived roles, MFA implementation, role provisioning or real Google configuration changes.
7. Read [Milestone 1](../backlog/milestone-1.md), its capability/dependency notes and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.
8. Keep pages/layouts server-rendered, use typed translation keys and generated API types, and restrict API calls to server-only wrappers. Use the existing Vitest/Testing Library/Playwright conventions; test affected SSR, accessibility, safe failure and environment boundaries.
9. Confirm required capabilities in the approved published client before implementation. Stop on missing methods or unresolved contract/security conflicts and request an amendment to the linked API task; do not invent fields, endpoints or successful mock fallbacks.

## Acceptance criteria

- [ ] Synthetic login navigation, account SSR, logout, session expiry, missing/invalid CSRF and unavailable API scenarios pass.
- [ ] Cookies, CSRF, tokens, raw failures and API origin are absent from public output, shared caches and logs; cross-user isolation and unsafe redirect rejection are tested.
- [ ] Live non-production Google sign-in/return/logout is recorded separately when configured; fixture success is not live-provider acceptance.
- [ ] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
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

**Local:** Use the isolated browser fixture for the acceptance scenarios above; no running API or real personal data is needed. For live manual checks, start `npm run dev` in a fresh terminal with existing local API configuration, then open the task's route recorded in WEB-M1-001 and repeat its success/failure scenarios.

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, using the published full commit-SHA release and the workflow's required configuration/API inputs. Open this task's approved routes on the site origin and repeat the acceptance scenarios with synthetic accounts/content; check `/healthz` and `/system-status` for regressions. Record the exact release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

