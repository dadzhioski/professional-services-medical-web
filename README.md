# Professional Services Medical Web

Next.js frontend repository for public doctor profiles and the future provider/admin web interfaces.

## Read first

1. `AGENTS.md`
2. [Build plan](build-plan.md)
3. [Milestone 0 backlog](docs/backlog/milestone-0.md)
4. the assigned file in `docs/tasks/`
5. the ADRs referenced by that task

## Repository ownership

This repository owns Next.js, SSR/SEO, frontend tests, the web image, Caddy/TLS, public routing, and web deployment. It does not own Spring Boot, PostgreSQL, Flyway, database backup, or API deployment.

## Planned root structure

```text
src/                         Next.js application source
public/                      static public assets
e2e/                         Playwright tests
deployment/                  web/Caddy Compose and public-edge operations
docs/adr/                    frontend and edge decisions
docs/backlog/                ordered repository backlog
docs/tasks/                  agent-ready task definitions
.github/workflows/           CI, image, deploy, rollback
Dockerfile                   non-root Next.js standalone image
package.json / lock file     pinned Node build
```

Application and workflow files are created by their assigned Milestone 0 tasks. Planning files must not pretend an unimplemented command already works.

## Cross-repository contract

The API repository owns the [canonical contract and generated client](https://github.com/dadzhioski/professional-services-platform-api/tree/main/openapi). The web will pin an exact `@dadzhioski/professional-services-api-client` version in WEB-M0-003; it never copies generated source or DTOs from the backend working tree. Version `0.2.0` was observed in the local backend package metadata during bootstrap; registry publication and installability have not been verified.

Caddy routing is planned for WEB-M0-005: `/api/*` to `api:8080` on the external Docker network `professional-services-edge`, and all other public traffic to `web:3000`.

## Local setup

Use Node **24.19.0** and npm **11.17.0**. `.nvmrc` records the Node version for compatible version managers; `package.json` pins both engine versions and declares `packageManager: npm@11.17.0`. These declarations do not install the toolchain automatically. `.npmrc` rejects incompatible engines and saves new dependencies with exact versions.

From this repository root (PowerShell or a POSIX shell):

```sh
node --version
npm --version
npm ci
```

No environment variables, registry credentials, backend services, or application dependencies are required for bootstrap. `.env.example` documents this; local `.env` files must remain ignored.

Commit `package-lock.json` with `package.json`. Use `npm ci` for reproducible installation; use the pinned npm version to make intentional dependency changes and review both files together. Do not hand-edit the lock file or introduce another package manager's lock file.

The `lint`, `typecheck`, `test`, and `build` scripts are placeholders. Each prints `not implemented until WEB-M0-002` and exits with code 1. Installation is supported; application verification is not yet implemented. Playwright arrives in WEB-M0-004.

## Current phase

WEB-M0-001 provides the repository and toolchain bootstrap. The planned directories above are created only when their tasks need them.

1. [WEB-M0-002](docs/tasks/WEB-M0-002-nextjs-ssr-foundation.md) adds Next.js, strict TypeScript, SSR, health, and unit-test foundations.
2. [WEB-M0-003](docs/tasks/WEB-M0-003-api-client-status-integration.md) adds a server-rendered `/system-status` page using the released generated client. It requires API-M0-005 generation and verified API-M0-006 registry publication, registry access, and a reachable server-only API URL. Keep any installation token in local configuration outside source control.

The existing deployment files are templates for later tasks; bootstrap does not deploy anything.
