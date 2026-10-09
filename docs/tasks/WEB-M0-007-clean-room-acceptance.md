# WEB-M0-007: Perform clean-room frontend and integration acceptance

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-006
- **Related ADRs:** All accepted WEB Milestone 0 ADRs
- **Cross-repository dependency:** Tested API client package and compatible non-production API release
- **Risk:** Medium

## Goal

Verify the web repository from a clean checkout and prove its documented integration with the API without modifying or administrating the backend repository.

## Allowed scope

- clean clone on a supported environment;
- install, lint, typecheck, tests, build, image, Compose, Caddy routing, deploy-script, and rollback checks;
- installation of the exact released API-client package;
- integration against a selected compatible API release;
- correction of narrow documentation and reproducibility defects;
- final evidence report.

## Non-goals

- no product feature, API source change, dependency upgrade, architecture change, real production access, or waived failure.

## Requirements

1. Use only documented prerequisites, synthetic data, and published API artifacts.
2. Record OS, architecture, exact tool/client/image versions, commands, results, and durations.
3. Treat copied DTOs, hidden sibling paths, undocumented credentials, flaky SSR, and accessibility failures as defects.
4. Human owner makes the final acceptance decision.

## Acceptance criteria

- [ ] Clean `npm ci` and all quality gates pass.
- [ ] Web builds without API source code present.
- [ ] Exact generated client version is installed and recorded.
- [ ] Immutable non-root image passes health and SSR checks.
- [ ] Caddy routes web and API correctly while remaining the only public entry point.
- [ ] API-unavailable behavior passes.
- [ ] Non-production web deploy and web-only rollback pass.
- [ ] No secret, real personal data, floating dependency, duplicate DTO, or mutable image exists.
- [ ] Report recommends proceed or stop with evidence.
- [ ] Human owner approves or rejects Milestone 1.

## Verification

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run e2e
make image-smoke-test
make integration-routing-test
make web-release-smoke
make web-rollback-smoke
```

## Security and privacy

Use synthetic data and disposable non-production infrastructure. Do not access production credentials.

## Handoff

Provide the evidence matrix, exact client/API/web versions, SSR and accessibility results, unresolved limitations, and explicit go/no-go recommendation.
