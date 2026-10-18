# WEB-M1-003: Integrate Google sign-in and secure server sessions

- **Status:** IMPLEMENTED — local synthetic, security, image, edge, release and rollback checks passed (2026-10-16); human boundary review and live identity compatibility/return-allowlist/Google/VPS acceptance pending
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-001 auth decisions; WEB-M1-002
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0005; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (identity/session and PUBLIC_ORIGIN accepted by the owner; implementation review pending)
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
- No Caddy routing, workflow permission, publishing, pushing, pull request, deployment execution or Milestone 0 acceptance reconstruction changes.

## Owner-approved implementation amendment (2026-10-16)

The owner accepted WEB-ADR-0006's identity/session and PUBLIC_ORIGIN design and
explicitly requested implementation of the plan including narrowly required
PUBLIC_ORIGIN wiring in CI, Docker, deployment configuration and existing
verification scripts. This supersedes the original blanket exclusion of those
files; it does not authorize deployment or API operations. Human review of the
implemented boundary and tests remains required. Media/administrator gates are
unaffected.

Published `0.2.0` registry integrity matches the lockfile, and all 24 published
artifact files were compared byte-for-byte with the installed package. Generated
identity methods/raw headers and the sibling API's documented cookie/CSRF/return
contracts were inspected. This is not deployed-API compatibility evidence.
API-owner release readiness must confirm the exact four localized provider return
paths, matching public origin and session settings; no API configuration was changed.

## WEB-M1-001 decisions and implementation coverage

Follow the approved design scope and reviewed ADR boundary: same-origin Google navigation with exact localized return allowlists, per-request allowlisted session forwarding, and CSRF bootstrap/cookie changes only in handlers/actions capable of propagating approved Set-Cookie attributes and deletion. Read-only Server Components must not create sessions. Introduce validated server-only PUBLIC_ORIGIN for web mutation origin checks and protect both web and upstream mutations. Test missing/invalid origin, cookie propagation/rotation/deletion and cross-user CSRF isolation. ADR review and identity provenance/compatibility remain gates; administrator reconciliation does not block provider identity work.

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

- [x] Synthetic login navigation, account SSR, logout, session expiry, missing/invalid CSRF and unavailable API scenarios pass.
- [x] Cookies, CSRF, tokens, raw failures and API origin are absent from public output, shared caches and logs; cross-user isolation and unsafe redirect rejection are tested.
- [ ] Live non-production Google sign-in/return/logout is recorded separately when configured; fixture success is not live-provider acceptance.
- [x] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; pending checks are reported honestly.
- [x] No deferred Milestone 0 obligation is marked passed or waived.

Local evidence (2026-10-16): pinned Node/npm; lint, typecheck, 136 unit tests,
production build, unchanged client 0.2.0 policy, 50 policy tests, 70 desktop/mobile
browser scenarios and a final 14-scenario identity rerun passed. Image builds,
runtime configuration rejection/image smoke, production configuration validation,
edge routing/outage/restart checks and 8 edge browser scenarios passed. Secret
scan, workflow validation, dependency gate (unchanged exception through
2026-10-26T00:00:00Z) and web/edge image scans passed. Windows Playwright test
servers required explicit cleanup after their scenarios finished. No local env
file, live API configuration, production resource, dependency or Caddy route was
changed. Live Google/VPS acceptance, deployed identity compatibility and API-owner
confirmation of the localized return allowlist remain unexecuted; human review of
the implemented environment/session boundary remains required.

The existing release HTTP probe still required HTTP 200 at `/`, conflicting with
WEB-M1-002's implemented locale redirect. Verification now accepts one 307 to a
plain local locale path, with negative tests for external destinations, queries
and redirect chains; Caddy routing is unchanged. Synthetic release preflight and
failed-verification recovery passed after this correction. Explicit A-to-B-to-A
rollback also passed, preserving the independent fixture and Caddy volumes; all
owned integration resources were removed. Final web and edge scans report zero
high/critical findings and zero secrets. No real deployment or rollback was run.

## Verification

Use the repository's pinned toolchain and existing installed dependencies; run `npm ci` if installation is needed. For build/type generation, use an existing valid configuration or this synthetic origin (no API process is required):

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:4310'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run test:policy
npm run e2e
git diff --check
```

**Local:** Use the isolated browser fixture for the acceptance scenarios above; no running API or real personal data is needed. Set `PUBLIC_ORIGIN=http://localhost:3000` in the process environment before `npm run dev` and open `/mk/provider` (or `/en/provider`, `/bg/provider`, `/sq/provider`) for the translated signed-out shell. Live Google checks require the shared Caddy origin and independently configured compatible API; `npm run dev` alone does not route `/api/*`. Follow README's provider sign-in prerequisites and use the actual shared origin for PUBLIC_ORIGIN.

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, using the published full commit-SHA release and the workflow's required configuration/API inputs. Open this task's approved routes on the site origin and repeat the acceptance scenarios with synthetic accounts/content; check `/healthz` and `/system-status` for regressions. Record the exact release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

No secrets, session/CSRF values, private evidence, PII or raw API failures in logs or public output. No shared private caching; API authorization remains authoritative. New cookies, dependencies, client upgrades, environment boundaries and production changes retain AGENTS.md approval requirements. Only professional profile/qualification content is in scope; never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.

