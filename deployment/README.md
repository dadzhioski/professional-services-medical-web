# Web and public-edge deployment

WEB-M0-005 implements the web-owned edge described by WEB-ADR-0004 and WEB-ADR-0005. WEB-M0-006 adds the protected release workflow and restricted host entry point described below; protected VPS proof and human review remain acceptance gates. This project defines only web and Caddy; the API repository independently provides `api:8080`.

## Prerequisites and inputs

Use Docker Engine with Linux containers, Compose **2.24.4 or newer**, Node 24.19.0, npm 11.17.0, and GNU Make (or run the Node commands listed in Makefile on Windows). Configure private-package read access before building the web image. Production requires an approved domain, correct DNS, inbound TCP 80/443 and UDP 443 if using HTTP/3, outbound certificate-authority access, and storage for Caddy state. No real DNS/certificate/production operation is needed for local verification.

Keep actual configuration outside Git. `.env.production.example` contains synthetic values only. The validator accepts `WEB_IMAGE` and `SITE_ADDRESS` from the process environment. A production image must use a bare 40-character lowercase commit-SHA tag, matching CI publication; `sha-` prefixes, short hashes and mutable tags fail validation. Run validation before any later deployment command; Compose interpolation by itself only checks presence and is not the SHA policy gate.

| Input | Contract |
| --- | --- |
| `WEB_IMAGE` | Full-SHA web image; local smoke defaults to the current HEAD image |
| `SITE_ADDRESS` | One approved DNS hostname, optionally prefixed by `https://`; validation defaults to `medical.example.test` |
| `PUBLIC_ORIGIN` | Exact HTTPS web origin matching `SITE_ADDRESS`; the protected host runner supplies its existing validated `host.origin` |
| `EDGE_NETWORK` | Host bootstrap defaults to `professional-services-edge`; integration always uses its own random network |
| API client | Exact `@dadzhioski/professional-services-api-client@0.3.0`; smoke checks the image label against package/lock files |
| `CADDY_IMAGE` | Full-SHA `professional-services-medical-edge` image; local checks default to current HEAD |

The edge image rebuilds Caddy 2.11.7 with Go 1.26.9 and `golang.org/x/net@v0.60.0` to fix four high scanner findings in the upstream binary. Compiler and runtime base digests are pinned in `Dockerfile.caddy`; no new Caddy plugins are added. Build it with `make edge-image`. Release context is available in the [upstream releases](https://github.com/caddyserver/caddy/releases/tag/v2.11.7). Local images built with uncommitted changes are development evidence, not publishable releases.

## Runtime boundary

WEB-M1-003 adds required server-only `PUBLIC_ORIGIN`. Install the reviewed host
scripts and new immutable Compose configuration together before deploying this
release; no new workflow input or host.json field is needed. The host runner
passes its validated `origin` to Compose, which passes it into the web container.
The runtime value is independent of the synthetic Docker build value. Validation
accepts older immutable configurations without this variable for rollback; when
present it must match the approved site. Do not edit historical configurations.

Before live provider acceptance, the API owner must confirm compatible identity
behavior, the same public origin, Google callback configuration and exact return
paths `/mk/provider`, `/en/provider`, `/bg/provider`, `/sq/provider` (plus the API's
required `/`). Test login, return and logout with synthetic accounts through the
site origin in all locales, then expiry and safe unavailable states. Local browser
fixtures are not live Google acceptance. This change does not authorize deployment.

Only Caddy publishes 80/tcp, 443/tcp and 443/udp. Web exposes 3000 only inside the external edge network under alias `web`. Its API origin is fixed server-side to `http://api:8080`; it is never a `NEXT_PUBLIC_*` value. The API and PostgreSQL are not services in this project.

`make edge-network` idempotently creates the external host network. Ordinary shutdown must preserve it. Caddy owns named `caddy-data` and `caddy-config` volumes; never use `down --volumes` on the production project. `/etc/caddy/Caddyfile` is mounted read-only. Web runs as the image's non-root user with all capabilities dropped. Both services use `unless-stopped` and `no-new-privileges`.

Initial limits are 512 MiB/1 CPU for web and 256 MiB/0.5 CPU for Caddy. These are starting limits, not load-tested capacity claims; measure memory, latency and OOM events under expected traffic before production.

Web's image health check calls its own `/healthz`, independently of the API. Caddy's health check reads its loopback-only admin configuration endpoint on 2019; that endpoint is never published. End-to-end checks additionally verify `/healthz` through the public edge. An API outage does not require either web or Caddy to restart.

## Routing and privacy

- `/api/*` reaches `api:8080` with the complete path and query preserved. Bare `/api` follows the web route and currently returns 404.
- Other paths reach `web:3000`; `/system-status` remains dynamically server-rendered and renders its translated fallback after a bounded API failure.
- API proxy dial timeout is 2 seconds and header/read/write timeouts are 6 seconds. Web proxy dial timeout is 2 seconds and header/read/write timeouts are 10 seconds. The web API wrapper retains its five-second abort.
- Proxy-generated failures have an empty response body and safe HTTP error status. Ordinary API responses, including business errors, retain their contract; the edge does not sanitize arbitrary API business payloads.
- Caddy trusts no external forwarded-header sender. Tests inject spoofed forwarded values and verify replacement. Adding another trusted proxy requires review.
- Responses remove `Server`, set `nosniff` and `strict-origin-when-cross-origin`, and set one-year HSTS on HTTPS only, without preload or includeSubDomains. No new CSP is introduced.
- Access logs omit the complete request object, response headers, user ID and error trace/ID. They retain status, timing, size and a constant `api`/`web` route category instead of arbitrary URLs. Raw `http.log.error` logs are excluded because they contain upstream/request details; safe access statuses and health checks remain observable. Runtime startup/TLS diagnostics remain available.
- Docker rotates each service's logs at 10 MiB, retaining five files (approximately 50 MiB/service). This is a size bound, not a time-based retention promise. Never enable debug/request-body logging or credentials logging in production.

See Caddy's [logging reference](https://caddyserver.com/docs/caddyfile/directives/log) and [proxy reference](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) for the reviewed directives. No runtime application secret is required for the current status page. Registry/build credentials remain transient and outside Compose/source control. Future runtime secret injection must be separately reviewed.

## Isolated local verification

Build the current web image, then run:

```sh
make image
make edge-image
make validate-production-config
make integration-up
make integration-routing-test
make integration-api-unavailable-test
make integration-restart-test
make integration-browser-test
make integration-down
make edge-container-scan
```

Always run `integration-down` after a failed manual run, too. `make integration-test` runs validation, startup, routing/outage/restart and cleanup in a finally block; the browser target is separate and requires the stack to remain up. CI uses the individual targets and an unconditional cleanup step. `make edge-network` is a host-bootstrap command, not a prerequisite for isolated smoke; test startup owns its own external network.

The smoke override uses the production Caddyfile and images, explicitly replaces production port bindings with one random loopback HTTP port, and requests no certificate. Each run owns a random Compose project, labeled network and synthetic transport container. `reports/integration-state.json` records only synthetic resource identities and the discovered origin. One run per checkout is supported; a second startup refuses to overwrite its state. Outage controls listen only on fixture loopback and are invoked through Docker exec. Only the harness-owned fixture can be disconnected; no actual API container is controlled.

Tests prove path/query preservation, spoofed-forwarding rejection, raw SSR, static assets, independent health, HTTP error/stall/refused/missing-DNS failure modes, recovery, token/query/cookie canary absence in logs, and persistent Caddy volume markers. Restart and force-recreation compare the fixture identity/start time/restart count and rediscover the ephemeral port. Desktop/mobile browser checks prove JavaScript-disabled content, focus/skip-link behavior, overflow and axe results for success and outage states.

Smoke cleanup removes only its own project/volumes, labeled fixture and labeled network. It never removes the host edge network or backend resources. CI prints sanitized check summaries rather than uploading raw container logs. The Caddy and web scans reject high/critical vulnerabilities and secrets and require OS plus application inventories.

## Independently deployed API compatibility

Synthetic fixtures prove transport behavior, not real release compatibility. Provision a disposable non-production API using its own repository and expose a matching web/Caddy stack on a loopback HTTP port. This repository provides no backend startup or teardown command.

Set `API_IMAGE` to the chosen full-SHA API image, `EXPECTED_API_VERSION` to the expected status version, `API_CONTAINER` to that running container, `COMPATIBILITY_WEB_CONTAINER` and `COMPATIBILITY_CADDY_CONTAINER` to the matching web/edge containers, and `COMPATIBILITY_ORIGIN=http://127.0.0.1:<port>`. Run `make integration-compatibility-test`.

The checker is read-only: it verifies image identity, shared aliases, actual Caddy port binding, client metadata, API status/version, SSR and health. It rejects the synthetic fixture label and requires all inputs explicitly. Missing prerequisites mean this check is unexecuted, not passed. Local inspection during implementation found no running independent API.

## Human review before production

Review the concrete public bindings, domain/TLS/HSTS behavior, forwarding trust, size-bounded log policy, omission of raw proxy errors, secret boundary, and security headers in this change. Production execution requires separate owner authorization and protected human approval. Domainless tests do not prove real certificate issuance, DNS, production capacity or production rollback.

## Protected release setup (WEB-M0-006)

The `Protected medical web release` workflow (`deploy.yml`) is manual only and
executes only from this repository's `main`. Select `deploy` or `rollback` and
the fixed `non-production` or `production` environment. No merge triggers a
deployment. Neither operation controls the API, PostgreSQL, or their Compose
project. Initial installation has no rollback target; a second successful
release is needed to prove restoration of a previous release.

Both environments require a deployment branch rule allowing only `main` (not tags).
For `non-production`, leave **Required reviewers** unchecked: the owner authorized
manual deploy and rollback without a separate approver on 2026-10-16.
For `production`, required reviewers, prevention of self-review and disabled
administrator bypass remain mandatory. Protect `main` with required review and CI.
Confirm the GitHub plan supports the required production controls. The host checks
the active main workflow-dispatch run and its environment approval history via
the [GitHub review-history API](https://docs.github.com/en/rest/actions/workflow-runs#get-the-review-history-for-a-workflow-run).
Production requires approval for that environment. Non-production accepts empty
approval history, but rejects any recorded rejection for that environment. Rejected
runs cannot be reused. This applies to deploy and rollback. The request must still
match the root-owned host environment; all release and compatibility checks remain.

To activate this policy, merge the reviewed scripts to `main` and have an
administrator install the updated complete `scripts/` tree under
`/opt/medical-web-deploy` on the non-production host. Changing the GitHub checkbox
alone does not update the installed host validator. No new flag or secret is needed.

Configure the following separately in each environment; never put real values
in this repository or chat:

| Name | Kind | Purpose |
| --- | --- | --- |
| `WEB_DEPLOY_SSH_KEY` | Secret | Dedicated restricted deployment key |
| `WEB_DEPLOY_ENABLED` | Variable | Set `true` only after permissions and approval gates are reviewed |
| `WEB_DEPLOY_HOST` | Variable | Approved VPS hostname or IPv4 address |
| `WEB_DEPLOY_PORT` | Variable | Explicit SSH port |
| `WEB_DEPLOY_USER` | Variable | Dedicated `webdeploy` account |
| `WEB_DEPLOY_KNOWN_HOSTS` | Variable | Host-key entry verified through an independent trusted channel; include `[host]:port` for a non-default port |
| `WEB_DEPLOY_ORIGIN` | Variable | Exact HTTPS origin without a trailing slash; must match host configuration |

The release job uses `contents: read` and `actions: read`, without package-write,
deployment-write, OIDC, or backend permissions. It does not install npm packages.
SSH uses strict host-key checking, no agent, no PTY, and a temporary mode-0600 key
file removed in `finally`; raw SSH errors and remote response bodies are withheld.
Do not replace host-key pinning with runtime `ssh-keyscan` trust.

### Administrator-owned host installation

Perform this setup manually from a reviewed checkout, not through workflow
credentials. The host needs Linux Docker/Compose, Node **24.19.0** at
`/usr/bin/node`, OpenSSH, sudo, and unzip. This task does not install or operate
the API; its owner must independently supply a running compatible full-SHA
image, its status version, and the container identity. The existing external
`professional-services-edge` network must already exist.

1. Create a dedicated `webdeploy` account with password login disabled, no
   Docker-group membership, no general sudo, and no write access to deployment
   code, configuration, state, backend paths, or its authorized key file.
2. Install the reviewed `scripts/` tree plus `package.json` and
   `package-lock.json` under `/opt/medical-web-deploy`, root-owned and not group
   or world writable; no npm installation is necessary. All parent directories
   must also be root-owned and not group/world writable. Updating these files
   always requires administrator review/installation.
3. Create root-owned `/etc/medical-web-deploy` and
   `/var/lib/medical-web-deploy` with mode 0700. Install `host.json` below and
   credentials as mode 0600. Reject symlinks and writable parent directories.
4. Put a repository-scoped, read-only GitHub credential with **Actions: read**
   under `/etc/medical-web-deploy/github-token`; no write permission. Configure
   read-only GHCR pull access to only the two web-owned packages under
   `/etc/medical-web-deploy/docker/config.json`. Use stdin for registry login,
   never command-line token values. These credentials are host-only, absent
   from the workflow, application containers and release journal.
5. Install approved `compose.yaml` and `Caddyfile` under
   `/etc/medical-web-deploy/configurations/<identifier>/`, root-owned and not
   group/world writable. Use exact Git blob bytes from the published release
   (for example a Git archive), avoiding checkout newline conversion. Compare
   their SHA-256 hashes with the release manifest. Keep previous configurations
   unchanged for rollback; do not accept uploads from the deployment account.
6. Add the restricted public key to a root-owned authorized-keys file:

   ```text
   restrict,command="/usr/bin/node /opt/medical-web-deploy/scripts/deploy-ssh.mjs" ssh-ed25519 PUBLIC_KEY
   ```

   Enforce a matching sshd `ForceCommand` for `webdeploy`, `DisableForwarding yes`, `PermitTTY no`,
   `AllowTcpForwarding no`, `AllowAgentForwarding no`, `X11Forwarding no`,
   `PermitTunnel no`, and `PermitUserEnvironment no`; do not accept `NODE_*`
   environment variables. Validate sshd configuration before administrator
   reload, keeping a separate administration connection open. The account needs
   an executable login shell for OpenSSH to invoke the forced command, but no
   interactive shell access; see the [OpenSSH ForceCommand contract](https://man.openbsd.org/sshd_config.5#ForceCommand).
7. Grant only this exact sudo command, validating the file with `visudo -cf`
   before installation (escaped `=` and `:` are sudoers syntax):

   ```sudoers
   Defaults:webdeploy env_reset
   webdeploy ALL=(root) NOPASSWD: /usr/bin/env -i PATH\=/usr/bin\:/bin /usr/bin/node /opt/medical-web-deploy/scripts/deploy-host.mjs
   ```

   No wildcard arguments, shells, Docker CLI, generic Node invocation or
   writable scripts may be granted. The forced command accepts only the literal
   SSH command `web-release`; its JSON input is bounded to 4096 bytes and five
   seconds. The privileged process runs with a clean environment.

Synthetic `host.json` shape (replace values only on the non-production host):

```json
{
  "environment": "non-production",
  "origin": "https://medical.example.test",
  "apiContainer": "independently-managed-api",
  "apiRepository": "ghcr.io/example/independently-managed-api"
}
```

### Release evidence, preflight and recovery

Deploy inputs are `release_sha` (40 lowercase hex characters), `configuration`
(an installed identifier), `api_image` (the independently deployed full-SHA API
image), and `api_version` (its expected status version). Image repository names
for web/Caddy are fixed in code. CI publishes `release-<SHA>-<attempt>` containing
`release.json` only after both verified images have been published; retain it
for 90 days. A successful trusted-main CI run, matching artifact digest and
unexpired evidence are required by both runner and host. Older images without
this evidence cannot be selected for a new deployment. No arbitrary tag or
registry input is accepted for web/Caddy.

The host checks installed configuration hashes, API image/container identity,
the API alias and status version, then pulls and checks the selected web/edge
digests, revision labels and exact client version. Temporary candidate web and
Caddy containers use unique names without the `web` alias, a random loopback
port, no application credentials, and temporary Caddy storage. The probe derives
its Caddyfile from the approved configuration by replacing only the web upstream
with the unique candidate name; production routing is unchanged. This verifies
candidate SSR and `/api/*` before any active web/Caddy replacement, including the
first installation when no public edge is running. Cleanup removes only labeled
probe containers and their generated Caddyfile, never the external network.

The fixed project `professional-services-medical-web` is updated with
`compose up` for `web caddy` only, without builds or another pull. Each Docker
operation is limited to five minutes, readiness checks to two minutes, and HTTP
requests to twelve seconds. Verification covers container image identity and
health, `/healthz`, raw `/system-status` SSR, home/status metadata, existing
HTTP security headers including HTTPS HSTS, and `/api/v1/system/status`.
The runner checks the public HTTPS origin again. No zero-downtime guarantee.

Successful release records are root-only JSON in
`/var/lib/medical-web-deploy/records`; `state.json` retains current, previous,
and pending identifiers. The previous record and proposed release are written
before replacement; atomic writes and an exclusive host lock protect state.
Journals contain only validated release identifiers and failure stages, not
container logs, HTTP bodies, credentials or user data. Workflow summaries show
the successful release-record identifier and SHA.

For rollback select `rollback` and supply `release_record` from an earlier
successful run; leave deploy inputs empty. The host restores that record's
web/Caddy images and approved configuration after compatibility preflight,
preserving Caddy volumes and backend resources. A previously verified root-owned
record remains durable rollback evidence after its CI artifact expires; expiry
blocks new deployments, not restoration of recorded successful releases. Keep
the referenced images available in GHCR and retain installed configurations.
Rollback requires the record's exact API image/version to remain healthy; it
does not infer compatibility after an independent API upgrade and never
reinstalls an old API. Coordinate API releases accordingly; a different API
identity needs new compatibility evidence through an approved deployment.

Failed verification never silently rolls back or replaces the last successful
record. A pending failed release blocks another deploy until an explicit
rollback succeeds. Process termination may leave the lock and labeled probes:
an administrator must confirm no deployment process is active, inspect the
sanitized journal, remove only that attempt's identified probe resources, and
remove the empty lock directory before an approved rollback. Do not clear state
to bypass failure. If the first installation failed and no successful record
exists, administrator recovery is required before retry; rollback is rejected.
An existing web/Caddy project without a release record, or image drift from its
recorded successful release, also blocks deployment and requires administrator
reconciliation; it is never silently adopted as a rollback baseline.

### Verification and outstanding protected proof

```sh
make validate-workflows
make test-deploy-scripts
make image
make edge-image
make web-release-smoke
make web-rollback-smoke
make integration-down
```

Windows may use the exact Node commands in `Makefile`. Both release smoke
targets own isolated synthetic resources and clean up in `finally`; always run
`integration-down` if manually interrupted. Synthetic image identities exercise
the shared transaction engine, candidate checks, replacement and restoration;
they are never published and do not prove GitHub approval, SSH/sudo permissions,
real API compatibility, certificate issuance or VPS deployment.

After the workflow is merged and two releases with successful CI publication
exist, complete the protected proof on the non-production VPS:

1. Administrator: install the boundary above; verify the restricted account has
   no Docker/backend authority. Harmless SSH commands such as `true`, `id`, or
   `docker version` must be rejected before sudo; do not test destructive
   backend commands. Obtain API/PostgreSQL container IDs, start times and restart
   counts through the backend administrator for read-only before/after comparison.
2. Dispatch `Protected medical web release` on `main`, `deploy`,
   `non-production`, release A's SHA/configuration and the actual API image/version;
   leave Required reviewers unchecked for non-production. Save its record ID.
3. Check HTTPS `/healthz` for 200 and `{"status":"ok"}`, `/system-status` for
   server-rendered API status/version, and `/api/v1/system/status` for the expected
   API response; repeat after manual deployment of distinct release B.
4. Dispatch `rollback`, `non-production`, A's record ID; run it and repeat
   those checks. Confirm A's image/configuration identifiers, unchanged Caddy
   volumes and unchanged backend identities. No API stop/restart is authorized.

Until those steps are executed, WEB-M0-006 remains incomplete; no local or
synthetic result substitutes for protected VPS evidence. Production execution
requires its own explicit authorization and environment approval.
