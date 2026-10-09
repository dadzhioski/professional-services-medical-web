# Professional Services Medical Web

Next.js frontend for public doctor profiles and future provider/admin interfaces.

## Read first

1. [Agent instructions](AGENTS.md)
2. [Build plan](build-plan.md)
3. [Milestone 0 backlog](docs/backlog/milestone-0.md)
4. Assigned task in `docs/tasks/` and its referenced ADRs

## Local setup

Use Node **24.19.0** and npm **11.17.0** (pinned in `.nvmrc` and
`package.json`). Install that toolchain before running:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No custom environment variables, credentials, or
backend services are needed. Keep local environment files ignored.
`.npmrc` enforces exact engine versions and saves exact dependency versions.
Commit `package.json` and the npm-generated `package-lock.json` together.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js development server |
| `npm run lint` | Next.js/TypeScript/accessibility lint; warnings fail |
| `npm run typecheck` | Generate route types, then strict TypeScript |
| `npm test` | Non-interactive Vitest and Testing Library tests |
| `npm test -- --run` | Task verification equivalent |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on port 3000 |

After building and starting, `curl --fail http://localhost:3000/healthz`
returns HTTP 200 and only `{"status":"ok"}`, with `Cache-Control: no-store`.

## Foundation

Exact versions: Next.js **16.4.0**, React/React DOM **19.3.0**, TypeScript
**5.9.3**, Tailwind/PostCSS plugin **4.3.3**, Vitest **5.0.3**,
Testing Library React **16.3.3**, jest-dom **7.0.1**, jsdom **30.1.2**,
axe-core **4.14.0**, ESLint **9.39.5**, eslint-config-next **16.4.0**,
server-only **0.0.1**. Package and lock files are authoritative.

Pages and layout are Server Components. The neutral home page can be prerendered
at build time; its content is present in the initial HTML without browser
JavaScript. It has no dynamic data and needs no forced per-request rendering.
A source-owned Surface primitive provides responsive Tailwind styling.
User-visible application copy and metadata use typed English translation keys.
The development page has noindex/nofollow metadata.

Semantic header/main/footer, one page heading, language, a keyboard skip link,
a focusable main target, and visible focus outlines form the accessibility
baseline. Unit tests include static server rendering and axe structural checks.
jsdom cannot verify visual layout, keyboard navigation, or color contrast;
browser-level checks and Playwright are deferred to WEB-M0-004.

### Environment schema

- Server entry: `src/lib/config/server.ts` imports `server-only`, which makes
  accidental Client Component imports fail the Next.js build.
- Required `NODE_ENV`: exactly `development`, `test`, or `production`.
  Next.js supplies it for dev/build/start and Vitest supplies test.
  The pure schema validates during Next.js config loading and layout rendering;
  invalid or missing values throw a clear error without echoing input values.
- Public entry: `src/lib/config/public.ts` exports an immutable, typed empty
  allowlist. There are no `NEXT_PUBLIC_*` values yet.
- Future secrets belong only in the server module. Do not spread `process.env`,
  expose secrets as component props, or place secrets in Next.js `env` config.
  Any future public values must be explicitly selected and validated.

No analytics, external fonts, forms, cookies, or personal data collection are
introduced.

### Dependency limitation

The Next.js lint plugins currently declare ESLint 9 compatibility; ESLint 10
has incompatible peer ranges, so ESLint 9.39.5 is pinned despite its deprecation
notice. npm audit reports five high-severity entries in the development-only
Next.js lint chain from braces GHSA-vfj7-8cjw-p6xm. The registry's newest braces
release is still 3.0.3 and is affected; npm proposes a major Next lint-config
downgrade, not a compatible fix. Track an upstream fix and recheck in WEB-M0-004.
No arbitrary override, ignored advisory, or forced downgrade is applied.

## Repository and contract boundaries

This repository owns Next.js, SSR/SEO, frontend tests, the web image, Caddy/TLS,
public routing, and web deployment. It does not own Spring Boot, PostgreSQL,
Flyway, database backup, or API deployment.

No API-client package is installed in WEB-M0-002. WEB-M0-003 will pin a verified
published version of `@dadzhioski/professional-services-api-client`, consuming
the [API-owned contract](https://github.com/dadzhioski/professional-services-platform-api/tree/main/openapi)
without copying DTOs. The locally observed 0.2.0 is not proof of publication.
That task depends on API-M0-005 generation and API-M0-006 registry publication.

Playwright, CI, and Docker images arrive in WEB-M0-004. Caddy/Compose files remain
templates for WEB-M0-005; no deployment is performed. Caddy will route `/api/*`
to `api:8080` on `professional-services-edge`, and other requests to
`web:3000`. Production deployments require protected human approval.
