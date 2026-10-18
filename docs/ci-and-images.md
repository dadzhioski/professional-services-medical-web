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

Set `API_INTERNAL_URL=http://127.0.0.1:9` and
`PUBLIC_ORIGIN=http://127.0.0.1:4310` for type generation and build.
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
and requires `API_INTERNAL_URL` and `PUBLIC_ORIGIN` at startup. Image smoke checks
also verify rejection of missing/invalid public origins. The Docker build uses a
synthetic HTTPS origin; runtime validation reads the deployment value independently.
Smoke tests use disposable containers
and a private test network, bind a random port only to loopback, and clean up.
Production-shaped Caddy/Compose integration is implemented by WEB-M0-005;
see [deployment verification](../deployment/README.md). CI builds the separate
`professional-services-medical-edge:<full SHA>` image, validates its configuration,
tests isolated routing/outages/restarts/accessibility, and scans its OS/Go inventory.
Both verified images are saved together and published by a package matrix under
the existing publishing guard. Neither job deploys the images.

The edge image rebuilds Caddy 2.11.7 with Go 1.26.9 and `golang.org/x/net@v0.60.0`
because the upstream binary contains four high findings (CVE-2026-78667,
CVE-2026-78669 and CVE-2026-97031). Compiler and runtime base images are pinned
by digest in `deployment/Dockerfile.caddy`; no security exception is added.
Run `make edge-image` before validation and `make edge-container-scan` to check
the rebuilt artifact. This additional package needs the same reviewed GHCR
publication permissions as the web package. Builds use the public Go module
proxy/checksum database, with exact Caddy and networking dependency versions.

## Permissions and review

The CI workflow has three validation jobs, a publishing matrix, and release evidence:

| Job | Permissions | Credentials |
| --- | --- | --- |
| policy-and-secrets | contents: read | No registry credentials |
| dependency-security | contents: read | No registry credentials |
| verify | contents: read, packages: read | GITHUB_TOKEN only during installation and Docker build |
| publish-image | contents: read, packages: write | GITHUB_TOKEN for GHCR only |
| release-evidence | contents: read | Same-run artifact access only |

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
production permission, or database operation in CI. The separate manually
triggered `deploy.yml` uses protected environments and restricted SSH; its
setup and permissions are documented in [deployment setup](../deployment/README.md#protected-release-setup-web-m0-006).

## Protected release evidence

CI now validates workflows with digest-pinned actionlint and exercises the
shared release transaction engine through `make web-release-smoke` and
`make web-rollback-smoke`. Policy tests cover release input/evidence validation,
approval checks, locking, failure state, and explicit rollback; YAML wiring is
validated rather than mirrored in unit tests. Synthetic Docker tests prove
replacement/recovery and preserve the independent fixture and Caddy volumes.
The release HTTP probe accepts legacy root HTML or one 307 to a plain local
locale entry (currently `/mk`); external redirects, queries and redirect chains
remain rejected. Deployment probes receive a synthetic loopback PUBLIC_ORIGIN;
the actual release receives the independently validated host origin.

Each publishing matrix job records its published image digest, revision label,
and (for web) client version. After both jobs succeed, `release-evidence`
assembles `release.json` with the repository, full SHA, run ID/attempt, exact
client version, both image identities, and Compose/Caddyfile SHA-256 hashes.
The `release-<SHA>-<attempt>` artifact is retained for 90 days. Deployment checks
the successful main-push CI run and artifact digest through GitHub, then the
host independently repeats evidence validation and checks pulled image digests.
Missing, expired, fork/PR, failed, mismatched or untested evidence fails closed.
Existing published SHA tags without release evidence are not retroactively
approved; publish a new tested main commit. A failed partial publication still
refuses overwriting an existing SHA tag; investigate and publish a new commit.

The deployment job uses only `contents: read` and `actions: read`; registry pull
credentials are read-only and host-owned. Publishing permissions and the
`PUBLISHING_ENABLED` guard remain unchanged. Environment approval configuration,
host installation, manual non-production proof and human security review are
external acceptance gates, not claims made by a passing local test.

## Security gates and retained evidence

`npm run security:dependencies` runs `npm audit --json --audit-level=high`,
including development dependencies, and applies the owner-approved exception
below. High and critical findings otherwise fail, including unfixed findings.
CI and `make security-check` use this same gate. Running raw `npm audit` still
reports the accepted vulnerability and exits nonzero; it has not been fixed.
Gitleaks scans all fetched Git history and source files selected by Git, including
untracked non-ignored files. A temporary synthetic token must trigger detection;
the disposable directory is then removed. No real token is used for this probe.
Trivy scans the exported runtime image; high/critical vulnerabilities and any
secret findings fail the gate. Missing OS/Node inventories and scanner failures
also fail the command. Local reports live under ignored
`reports/security/`. Avoid uploading raw scanner reports that could contain
secret findings. Browser failure artifacts expire in seven days; verified image
handoffs expire in one day and are created only on trusted main pushes.

### Approved temporary development dependency exception

The repository owner approved this exception in chat on 2026-10-12, explicitly
responding "yes do the exception for these vulnerabilities" to the proposal for
GHSA-vfj7-8cjw-p6xm. Approval expires **2026-10-26 at 00:00 UTC**. It covers only:

| Development package | Installed version | Vulnerability source |
| --- | --- | --- |
| eslint-config-next | 16.4.0 | @next/eslint-plugin-next |
| @next/eslint-plugin-next | 16.4.0 | fast-glob |
| fast-glob | 3.3.1 | micromatch |
| micromatch | 4.0.8 | braces |
| braces | 3.0.3 | GHSA-vfj7-8cjw-p6xm |

The advisory can cause stack exhaustion from deeply nested brace patterns. The
accepted scope is the existing lint toolchain, not the deployed application.
There is no compatible patched release; npm's proposed forced fix downgrades
the Next.js lint configuration to another major version. This is temporary risk
acceptance, not remediation.

The machine-readable policy is `scripts/dependency-audit-exception.json`. The
gate checks the entire advisory chain and lockfile: each package must have its
approved version, exactly one expected top-level installation, and `dev: true`.
It rejects changed paths/versions, production use, extra advisories in the chain,
critical severity, malformed reports, audit errors, and expired approval. Each
accepted package, advisory URL, and deadline remain visible in CI output.
Unrelated high/critical findings always fail. Runtime-image scanning has no
exception and remains unchanged.

Before expiry, check upstream for a compatible fix, update the dependencies and
remove this policy when the advisory disappears. Any extension requires renewed
owner approval; there is no automatic renewal or environment-variable bypass.
