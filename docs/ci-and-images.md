# Web verification and image publishing

WEB-M0-004 implements WEB-ADR-0001, WEB-ADR-0002, WEB-ADR-0004 and
WEB-ADR-0005. The client remains
`@dadzhioski/professional-services-api-client@0.2.0`.

## Local verification

Use Node 24.19.0, npm 11.17.0, Docker, and GNU Make. Configure private-package
read access as described in README. No real API is required.

```sh
npm ci --ignore-scripts
npm run check:api-client-version
npm run test:policy
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx --no-install playwright install chromium
npm run e2e
make security-check
make image
make image-smoke-test
make container-scan
```

Set `API_INTERNAL_URL=http://127.0.0.1:9` for type generation and build.
Playwright overrides it with its isolated fixture origin. Ports 4310 and 4311
must be free; tests never reuse an existing server. Desktop and mobile Chromium
exercise SSR without JavaScript, outage/recovery, independent health, keyboard
focus, responsive overflow, axe including contrast, and absence of browser API
calls. Reports and retained failure traces contain synthetic fixture data only.

The Make targets delegate to Node scripts and also work directly on Windows.
`NPM_CONFIG_USERCONFIG` can select a user npm configuration file for image builds.
It is mounted through BuildKit, never copied. `NODE_AUTH_TOKEN`, if needed by
that file, is a second BuildKit secret. Do not pass credentials as build arguments.
The Docker context uses an allowlist and excludes local environment files.

Image names default to `professional-services-medical-web:<git HEAD full SHA>`;
`IMAGE` overrides must also have a full 40-character SHA tag. Local builds of
uncommitted changes are development evidence only, not published release artifacts.
The base uses digest-pinned Node 24.19.0 on Alpine 3.24, with libcrypto3 and
libssl3 pinned to 3.5.9-r0 to address CVE-2026-14456. The runtime starts
`node server.js`, listens on port 3000 as UID/GID 10001,
and requires `API_INTERNAL_URL` at startup. Smoke tests use disposable containers
and a private test network, bind a random port only to loopback, and clean up.
Production Caddy/Compose integration remains WEB-M0-005.

## Permissions and review

The workflow has three validation jobs and a separate publishing job:

| Job | Permissions | Credentials |
| --- | --- | --- |
| policy-and-secrets | contents: read | No registry credentials |
| dependency-security | contents: read | No registry credentials |
| verify | contents: read, packages: read | GITHUB_TOKEN only during installation and Docker build |
| publish-image | contents: read, packages: write | GITHUB_TOKEN for GHCR only |

Package settings must grant this web repository Actions read access to the
published API client. No PAT fallback is configured. Lifecycle scripts are
disabled during installation. Credentials are not persisted by checkout.
Dependency and Docker caches are not shared between runs or trust levels.
Third-party Actions are pinned to full SHAs; scanner/base images use digests.

Fork PRs run policy, secret and dependency checks, but fail the verification job
with an explicit private-package-access error. They receive no registry token.
Full fork verification remains an acceptance limitation until the owner approves
a credential-free way to consume the private client. Do not enable secrets for
forks or execute PR code via `pull_request_target` to bypass this boundary.

Per WEB-M0-004, a human must review package authentication and workflow
permissions before enabling publishing. After review, set the repository variable
`PUBLISHING_ENABLED=true`. Publishing runs only on this repository's main branch
after every gate succeeds. It downloads the same image verified by that run,
refuses to overwrite an existing SHA tag, pushes only that tag, and checks the
pulled image ID. There is no deployment environment, SSH credential, OIDC grant,
production permission, or database operation.

## Security gates and retained evidence

`npm audit --audit-level=high` includes development dependencies. High and critical
findings fail, including unfixed findings. No vulnerability exceptions exist.
Gitleaks scans all fetched Git history and source files selected by Git, including
untracked non-ignored files. A temporary synthetic token must trigger detection;
the disposable directory is then removed. No real token is used for this probe.
Trivy scans the exported runtime image; high/critical vulnerabilities and any
secret findings fail the gate. Missing OS/Node inventories and scanner failures
also fail the command. Local reports live under ignored
`reports/security/`. Avoid uploading raw scanner reports that could contain
secret findings. Browser failure artifacts expire in seven days; verified image
handoffs expire in one day and are created only on trusted main pushes.

The existing braces advisory GHSA-vfj7-8cjw-p6xm in the Next.js lint dependency
chain remains a release blocker if still reported. A forced downgrade to a
different Next.js major is not an acceptable automatic fix. Any exception needs
the human review required by WEB-M0-004 and an explicit scope and expiration.
