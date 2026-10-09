# WEB-ADR-0005: Pin the API client and deploy compatible releases independently

- **Status:** Accepted
- **Date:** 2026-10-01
- **Related tasks:** WEB-M0-003, WEB-M0-005, WEB-M0-006

## Context

There is no third release repository. The web must identify its API contract precisely and remain safe while the API and web are deployed at different times.

## Decision

Pin an exact generated client package version and embed that version in web image metadata. Before production deployment, run smoke tests against an explicitly selected API release. Deploy dependent web changes only after the backward-compatible API change is healthy.

Rollback changes only the web and Caddy image/configuration. It must not attempt database rollback or API replacement.

## Consequences

- independent web rollback is simple;
- compatibility is visible in source and image metadata;
- cross-repository changes need linked tasks and ordered releases;
- breaking API changes require parallel version support.

## Enforcement

- CI rejects ranges, wildcards, branches, file paths, and `latest` for the API client;
- E2E verifies success and API-unavailable states;
- deployment requires passing routing/integration checks and human approval.
