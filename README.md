# Professional Services Medical Web

Next.js frontend for public doctor profiles and future provider/admin interfaces.

## Read first

1. [Agent instructions](AGENTS.md)
2. [Build plan](build-plan.md)
3. [Milestone 0 backlog](docs/backlog/milestone-0.md)
4. Assigned task in `docs/tasks/` and its referenced ADRs

## Local setup

Use Node **24.19.0** and npm **11.17.0**, pinned in `.nvmrc` and
`package.json`. Configure package-read access as described below, then:

```sh
npm ci
```

Copy `.env.example` to ignored `.env.local` (or use an existing ignored
`.env`) and set `API_INTERNAL_URL` to your API origin, for example
`http://localhost:8080`. Do not include `/api/v1` or the status endpoint path.
Do not overwrite existing local configuration. Then run:

```sh
npm run dev
```

Open http://localhost:3000/system-status. A reachable API supplies service,
version, and status in the initial server-rendered HTML. An unreachable API,
timeout, HTTP error, malformed response, missing field, or unexpected status
produces the same safe unavailable message. Refresh to make a new request.

For production-mode local testing, stop the development server, run
`npm run build`, then `npm run start`. Rebuild and restart after source changes;
`npm run start` serves the last production build, not live source edits.
Valid configuration is required for dev, type generation, build, and start.
The API need not be running for builds or unit tests. Tests use synthetic
configuration and mocked transport; the running app has no mock fallback.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js development server |
| `npm run lint` | Next.js/TypeScript/accessibility lint; warnings fail |
| `npm run typecheck` | Generate route types, then strict TypeScript |
| `npm test` | Non-interactive Vitest and Testing Library tests |
| `npm test -- --run` | Task verification equivalent |
| `npm run build` | Production build without fetching API status |
| `npm run start` | Serve the production build on port 3000 |

`/healthz` returns HTTP 200, exactly `{"status":"ok"}`, and
`Cache-Control: no-store`, independently of backend availability.
`/system-status` returns HTTP 200 for both display states; it is informational,
not a readiness endpoint. It remains noindex/nofollow.

## API-client package and authentication

Installed production dependency:
**@dadzhioski/professional-services-api-client@0.2.0**.
Authenticated GitHub Packages metadata and installation were verified.
The npm-generated lock file records its immutable integrity.

Only the `@dadzhioski` scope routes to `https://npm.pkg.github.com`.
Other packages use the normal npm registry. Never put credentials in the
repository. Follow [GitHub's registry authentication guidance](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

Use a personal access token (classic) with `read:packages` and package access.
Authenticate locally with:

```sh
npm login --scope=@dadzhioski --auth-type=legacy --registry=https://npm.pkg.github.com
```

Enter your GitHub username and use the token at the password prompt. This stores
authentication in user-level npm configuration, outside the repository.

Alternatively, find that configuration with `npm config get userconfig` and
add the literal reference below, preserving other settings:

```ini
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Supply NODE_AUTH_TOKEN through your local secret-management mechanism.
npm does not automatically load application .env files for registry credentials.
Never put a token in chat, command arguments, source, or logs.

Verify access with:

```sh
npm whoami --registry=https://npm.pkg.github.com
npm view @dadzhioski/professional-services-api-client@0.2.0 version dist.integrity --registry=https://npm.pkg.github.com
```

A successful identity check does not prove package permission; E404 may mean
missing publication or insufficient access. API-M0-006 owns client publication.
A published API container image is a different artifact from the npm client.

### Explicit client upgrades

1. Identify an exact approved published client version and compatible API release.
2. Verify registry access and inspect the release's generated methods/types.
3. Use `npm install --save-exact @dadzhioski/professional-services-api-client@X.Y.Z`
   with that concrete version; commit package.json and the npm-generated lock
   file together. Never copy generated source, use local tarballs, or invent DTOs.
4. Run clean installation, lint, typecheck, tests, build, production status
   success/unavailable checks, and affected Playwright tests once introduced.
5. Record version, integrity, compatibility evidence, SSR/accessibility/privacy
   impact, and any unexecuted checks in an explicit reviewed PR. Missing contract
   behavior requires a linked API task. Deploy compatible API changes first.

## Rendering and environment boundaries

Pages and layouts remain Server Components. The neutral home page is prerendered.
The status route explicitly renders on every request. Its server-only adapter
uses the installed generated `SystemApi.getSystemStatus()` with no-store,
omitted credentials, no redirects/retries, and a five-second abort timeout.
It checks the generated fields for nonblank service/version and the generated
UP enum; its presentation result derives from `Required<SystemStatus>`.

Required server configuration:

| Variable | Accepted values |
|---|---|
| NODE_ENV | development, test, production; supplied by Next.js/Vitest |
| API_INTERNAL_URL | Absolute HTTP(S) origin, optional trailing slash; no credentials, non-root path, query, or fragment |

Configuration is validated during Next.js config loading and layout rendering.
Errors name the invalid setting without echoing its contents. Invalid
configuration fails fast; a valid but unreachable API renders unavailable.
The public environment allowlist is empty. Server configuration and the adapter
import `server-only`; importing them from a Client Component fails the build.
Never spread process.env, expose server config as client props, or put it in
Next.js env config. Raw API failures and internal URLs are not logged or rendered.

## Accessibility, privacy, and framework versions

Application copy and metadata use typed English translation keys. Server-rendered
pages reuse semantic landmarks, a focusable main target, skip link, visible focus
styles, and a responsive source-owned Surface. The status fields use a description
list. Tests cover structural accessibility with axe and server-rendered markup.
jsdom does not verify visual contrast, responsive layout, or real keyboard use;
browser checks and Playwright remain WEB-M0-004.

No personal data, forms, cookies, external fonts, or analytics are introduced.

Exact foundation versions: Next.js **16.4.0**, React/React DOM **19.3.0**,
TypeScript **5.9.3**, Tailwind/PostCSS plugin **4.3.3**, Vitest **5.0.3**,
Testing Library React **16.3.3**, jest-dom **7.0.1**, jsdom **30.1.2**,
axe-core **4.14.0**, ESLint **9.39.5**, eslint-config-next **16.4.0**,
server-only **0.0.1**. Package and lock files are authoritative.

### Existing dependency limitation

Next.js lint plugins declare ESLint 9 compatibility; ESLint 9.39.5 is pinned
despite its deprecation notice. The existing audit reports five high entries
from braces GHSA-vfj7-8cjw-p6xm in the development lint chain. No exception or
forced downgrade is introduced here; recheck upstream fixes in WEB-M0-004.
npm also warns that unrs-resolver postinstall is not allowlisted; no blanket
install-script approval is added.

## Repository boundaries

This repository owns the medical web, frontend tests, web image, and public
Caddy edge. The [API repository](https://github.com/dadzhioski/professional-services-platform-api)
owns backend code, canonical contracts, client generation/publication,
database migrations, and API deployment.

Playwright, CI policy checks, and Docker images remain WEB-M0-004. Caddy/Compose
files remain templates for WEB-M0-005. Deployment and rollback remain WEB-M0-006;
real production deployment requires protected human approval.
