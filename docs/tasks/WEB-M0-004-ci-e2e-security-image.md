# WEB-M0-004: Add web CI, E2E, security gates, and immutable image publishing

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-003
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0004
- **Risk:** High

## Goal

Verify medical-web changes, test status integration, and publish a non-root standalone image tagged by full commit SHA.

## Allowed scope

- PR CI for lint, typecheck, unit tests, build, exact-client policy, and Playwright;
- test status success and unavailable states using a controlled API fixture or published test API image;
- secret and dependency scanning;
- multi-stage non-root Next.js standalone Dockerfile;
- full-SHA GHCR image publishing from trusted main/release workflow;
- test-report artifacts and safe caching.

## Non-goals

- no real production deployment, backend source, database access, API-client publishing, or mutable image tag.

## Requirements

1. CI rejects non-exact API-client versions.
2. Untrusted pull requests receive no registry secrets.
3. Third-party actions use full commit SHAs.
4. Image runs as non-root and contains no package-manager cache or secret.
5. Playwright reports are retained on failure without sensitive content.

## Acceptance criteria

- [ ] All web gates run on pull requests.
- [ ] A non-exact client version fails policy validation.
- [ ] Playwright success and API-unavailable flows pass.
- [ ] Controlled secret pattern is detected and removed.
- [ ] Medical-web image is published with full-SHA tag.
- [ ] Image passes health, SSR, and vulnerability smoke checks.
- [ ] Image publishing has no production deployment permission.

## Verification

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run e2e
npm run build
npm run check:api-client-version
make image
make image-smoke-test
make container-scan
```

## Security and privacy

Human review is required for package-registry authentication, workflow permissions, and vulnerability exceptions.

## Handoff

Report exact client version, workflow permissions, image identifier, E2E results, and scan results.
