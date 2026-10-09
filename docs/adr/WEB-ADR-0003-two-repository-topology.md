# WEB-ADR-0003: Use two application-owned repositories

- **Status:** Accepted
- **Date:** 2026-10-01
- **Related tasks:** WEB-M0-001, WEB-M0-005

## Context

Java and Next.js need independent code, agent context, CI, and release ownership. A third operations repository would be disproportionate during the MVP foundation.

## Decision

Use one API repository and one medical-web repository. Each owns its build plan, ADRs, tasks, application image, and relevant deployment assets. This repository owns public ingress because Caddy primarily exposes the web product and routes `/api/*` to the independently deployed API.

Cross-repository work uses linked tasks and separate pull requests. The API contract and generated client form the integration boundary.

## Consequences

- frontend work remains isolated from Java and database context;
- Caddy and web releases are reviewed together;
- there is no third source of planning truth;
- shared edge-network and API compatibility rules must be documented in both repositories.

## Enforcement

- repository-specific agent instructions;
- exact generated client versions;
- one public Caddy instance owned here;
- no API or database deployment credentials in this repository.

## Revisit when

Create a dedicated operations repository after the system has several deployables, environments, infrastructure-as-code, or a distinct operations owner.
