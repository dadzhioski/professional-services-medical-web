# WEB-M0-004: Add web CI, E2E, security gates, and immutable image publishing

- **Status:** IMPLEMENTED (pending security resolution, hosted acceptance, and owner review)
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
- [x] A non-exact client version fails policy validation.
- [x] Playwright success and API-unavailable flows pass.
- [x] Controlled secret pattern is detected and removed.
- [ ] Medical-web image is published with full-SHA tag.
- [x] Image passes health, SSR, and vulnerability smoke checks.
- [x] Image publishing has no production deployment permission.

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

## Implementation evidence (2026-10-12)

- Exact client remains `@dadzhioski/professional-services-api-client@0.2.0`;
  package and lock integrity policy passes. Playwright is pinned to 1.64.0.
- Added PR/main CI, 16 dependency-free policy/security tests, secret scanning,
  npm auditing, production browser tests, standalone build, Docker smoke tests,
  image scanning, and disabled-by-default trusted-main image publishing.
- Clean `npm ci --ignore-scripts --no-audit --no-fund` passed. Lifecycle scripts
  remain disabled; no blanket approval was added. Lint, strict type checking,
  59 unit tests, production build, and six Playwright tests passed. Windows
  sandbox compiler/worker failures were resolved by rerunning with escalation.
- SSR remains request-time for `/system-status`; home remains prerendered.
  Playwright verifies initial content with JavaScript disabled and safe outage
  and recovery without rebuild. The health endpoint remains API-independent.
- Accessibility: desktop/mobile Chromium tests pass keyboard skip-link focus,
  responsive overflow and axe checks including contrast in both status states.
  Manual assistive-technology testing and other browser engines were not run.
- Privacy: only synthetic test data; no patient information, analytics, forms,
  or browser-side API calls. Image smoke verifies no internal API origin in
  HTML/static assets. Gitleaks history/source checks and temporary detection
  probe passed; the probe was removed.
- Added an allowlisted Docker context, BuildKit-only npm credentials, non-root
  UID/GID 10001, standalone static assets and healthcheck. Local image identifier:
  `professional-services-medical-web:94702f855bb861529714ef6a9ce79a9eee8364f9`.
  This tags a local dirty-tree verification build, not a published release.
- Final Alpine runtime build, health/SSR/static-asset/non-root smoke tests and
  Trivy scan passed: zero high/critical vulnerabilities and zero secrets.
  Both OS and Node package inventories were verified. OpenSSL libraries are
  pinned to 3.5.9-r0; no findings were suppressed. Local image config ID:
  `sha256:c0efa6fd1257a803a0ad04e92865e45f28b5e3d515083446372b596e0dbb8659`.
- Publishing requires all gates and `PUBLISHING_ENABLED=true`, only on trusted
  main. Verification has contents:read/packages:read; publishing has
  contents:read/packages:write. Other jobs have contents:read only. There is no
  production permission. Full action SHAs and scanner/base-image digests are
  pinned. No shared dependency/build cache is used.
- Remaining blocker: npm audit reports five high entries in the existing lint
  chain, rooted in braces GHSA-vfj7-8cjw-p6xm. Compatible `npm audit fix` did not
  resolve them. No forced framework downgrade or vulnerability exception added.
- Fork PRs receive no registry credential and explicitly fail private-client
  installation readiness. Full fork validation needs owner-approved private
  package access design; it is not claimed as passing.
- Hosted PR execution, GitHub Packages Actions access, GHCR push/pull and
  immutable-tag overwrite rejection have not been exercised. No image was
  published and no production deployment was attempted. Human review of
  package authentication and workflow permissions remains required by this task.
- See `docs/ci-and-images.md` for commands, permissions, and release setup.
