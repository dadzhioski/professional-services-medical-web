# WEB-ADR-0002: Consume an exact generated API-client version

- **Status:** Accepted
- **Date:** 2026-10-01
- **Related tasks:** WEB-M0-003, WEB-M0-004

## Context

The medical-web repository must remain compatible with independently released API versions without copying DTOs or depending on a live development branch.

## Decision

Depend on `@dadzhioski/professional-services-api-client` using an exact version in `package.json` and the lock file. Prohibit caret, tilde, wildcard, Git branch, file-copy, and `latest` references.

Client upgrades occur through explicit pull requests that run type checks, unit tests, production build, and relevant Playwright tests. If the client lacks required behavior, create a linked API task.

## Consequences

- builds are reproducible;
- compatibility changes are visible in review;
- client upgrades are not automatic;
- linked API and web tasks may be required for one product change.
