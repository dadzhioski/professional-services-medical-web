# WEB-M0-003: Integrate the exact API client and status page

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-002, API-M0-005, verified registry publication from API-M0-006
- **Related ADRs:** WEB-ADR-0002, WEB-ADR-0005
- **Risk:** Medium

## Goal

Install an exact released `@dadzhioski/professional-services-api-client` package and render backend status on a server-rendered `/system-status` page. API-M0-005 prepares the generated package; verify API-M0-006 registry publication and installability before selecting a release. The locally observed version `0.2.0` is not evidence of publication.

## Allowed scope

- configure GitHub Packages access without committing credentials;
- install one exact API-client version;
- add a server-only API wrapper;
- render service name, version, and status;
- render a safe unavailable state;
- add unit and server-rendering tests;
- document the client-upgrade process.

## Non-goals

- no handwritten API DTOs or direct contract copy;
- no API repository change;
- no authentication, profiles, product UI, or browser-side status call when SSR is sufficient;
- no silent mock fallback outside tests.

## Requirements

1. Dependency has no caret, tilde, wildcard, Git branch, file path, or `latest`.
2. Initial status content appears in server-rendered HTML.
3. API base URL is server-only.
4. Errors expose no internal URL, stack trace, or dependency details.
5. Client upgrade is an explicit reviewed change.

## Acceptance criteria

- [ ] Exact API-client version exists in package and lock files.
- [ ] Status page uses generated client types and methods.
- [ ] Server-rendered success and unavailable states pass tests.
- [ ] No duplicate DTO exists.
- [ ] Documentation explains authentication for private package installation without including a token.

## Verification

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
curl --fail http://localhost:3000/system-status
```

## Security and privacy

Registry tokens and API base URLs must not enter source, logs, or client bundles.

## Handoff

Report exact client version and evidence that content is server-rendered.
