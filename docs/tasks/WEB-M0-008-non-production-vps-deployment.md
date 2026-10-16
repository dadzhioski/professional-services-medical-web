# WEB-M0-008: Deploy and verify web on the existing non-production VPS

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-006 implementation; completes its outstanding protected VPS acceptance gates before WEB-M0-007
- **Related ADRs:** WEB-ADR-0004, WEB-ADR-0005
- **Cross-repository dependency:** Existing independently deployed healthy API release satisfying the API-M0-007 edge-network contract
- **Risk:** High

## Goal

Deploy the web and its public Caddy edge to the existing non-production VPS, prove integration with the already-running API, and prove protected web-only rollback without restarting or changing the API or PostgreSQL.

## Starting context

The owner confirms that the non-production VPS and backend API are already running. Host access, DNS, current ingress ownership, API image/version, network aliases, GitHub environment protections, and installed deployment tooling remain unverified. WEB-M0-006 has implemented the release mechanism but has not completed protected VPS proof. This task does not provision a replacement VPS or backend.

## Owner-authorized policy amendment (2026-10-16)

The owner requested deployment without an approver. Non-production deploy and
rollback therefore require manual workflow dispatch but no separate reviewer.
Production approvals remain mandatory. Update host authorization, regression tests
and deployment guidance together; all other release/security gates remain in force.
This amendment does not itself execute a remote deployment.

## Allowed scope

- Read-only discovery of the existing non-production deployment and ingress.
- Administrator setup of the documented restricted web deployment account, approved web configuration, host tooling, and credentials outside Git.
- Configuration and verification of GitHub protected environments and release inputs following `deployment/README.md`.
- Approved deployment of two distinct published web/Caddy releases and rollback through `Protected medical web release`.
- Narrow fixes to web deployment defects, with required tests and review before use.
- Updates to existing deployment documentation and task acceptance checkboxes using actual results; reconcile the stale deployment-status statement in `AGENTS.md` under the owner-authorized environment-specific approval policy.

## Non-goals

- No production deployment, backend deployment/restart, database operation, migration, API upgrade, or backend rollback.
- No direct Compose deployment that bypasses the protected workflow.
- No unapproved takeover of an existing proxy, ports, domain, network, or TLS configuration.
- No new product features, dependencies, API-client upgrade, or relaxation of release/security gates beyond the explicit non-production approval amendment.

## Requirements

1. Read `AGENTS.md`, `build-plan.md`, WEB-M0-006, the related ADRs, `deployment/README.md`, `docs/ci-and-images.md`, and the deployment scripts/workflows before execution. Task creation alone does not authorize remote mutations or bypass protected approval.
2. Confirm the target is non-production and obtain the approved access method and site origin through the appropriate secure channels. Never request or record private keys, tokens, or actual host configuration in Git or chat.
3. Inspect Docker/Compose, the required Node installation, DNS, public port ownership, existing web/Caddy state, and `professional-services-edge`. Verify that the running API has alias `api`, listens on 8080 on that network, and uses the expected immutable full-SHA image and status version. Obtain backend container identities, start times, and restart counts through the backend administrator for before/after comparison; do not dump environment variables or credentials.
4. If a proxy already occupies 80/443, document the concrete ingress transition for owner approval before any change. Do not stop the existing proxy automatically. If the API network contract is missing, request a linked API task; do not change the API container from this repository. An existing unrecorded web/Caddy project requires administrator reconciliation under the documented recovery procedure.
5. Confirm reviewed deployment code is on `main`, publishing is enabled only after its required review, and two distinct successful main CI releases have both immutable images and valid `release.json` evidence. Do not select old images lacking release evidence or manufacture a release record.
6. Follow the administrator-owned host installation in `deployment/README.md`: root-owned code/configuration/state, restricted `webdeploy` account, forced SSH command, exact sudo allowlist, read-only GitHub/GHCR credentials, and approved configuration bytes matching release-manifest hashes. Review concrete host changes before applying them; keep an independent administrator connection during SSH changes.
7. Verify main-only deployment rules for both environments. Leave non-production Required reviewers unchecked; retain required reviewers, prevention of self-review and disabled administrator bypass for production. Configure the documented `WEB_DEPLOY_*` secret/variables separately per environment and enable non-production deployment only after review. If the GitHub plan cannot enforce the required controls, report a blocker rather than weakening them.
8. Dispatch release A through the protected workflow with `operation=deploy`, `environment=non-production`, the full `release_sha`, installed `configuration` identifier, exact `api_image`, and expected `api_version`; leave `release_record` empty. Require manual dispatch and successful compatibility preflight before replacement. Save the successful release-record identifier securely.
9. Verify public HTTPS health, raw server-rendered status and API version, API routing, security headers, image identity, and container health. Deploy distinct release B through the same manual dispatch path, then dispatch `operation=rollback`, `environment=non-production`, and A's `release_record`, leaving deploy-only fields empty. Confirm A is restored and the backend identities and Caddy persistent volumes are unchanged.
10. Keep the API image/version unchanged during this proof. Do not stop the real API to test unavailable behavior; use the existing isolated fixture tests. A failed first installation has no rollback target and requires administrator recovery; a pending failed release must follow the documented explicit recovery/rollback path, never state deletion or automatic retry.
11. Record only sanitized workflow/run and release-record references and outcomes in existing task acceptance entries. Do not create a separate task report or store real domains, configuration, credentials, container logs, or response bodies. Mark WEB-M0-006's protected proof gates complete only after observed success and human review; report any unresolved gate explicitly.

## Acceptance criteria

- [ ] Existing non-production host, API identity, network contract, DNS, and ingress ownership verified.
- [ ] Required human review, environment-specific authorization controls, restricted SSH/sudo boundary, and host credential permissions verified.
- [ ] Harmless non-release SSH commands rejected; no Docker/backend authority granted to `webdeploy`.
- [ ] Release A deployed through an approved protected workflow with real API compatibility preflight passing.
- [ ] HTTPS `/healthz` returns 200 and `{"status":"ok"}`; `/system-status` contains the expected API service/version/status in raw HTML; `/api/v1/system/status` returns the expected API response through Caddy.
- [ ] Release B deployed and protected rollback restores A's exact images/configuration.
- [ ] API/PostgreSQL identities, start times and restart counts unchanged; Caddy persistent volumes preserved.
- [ ] No production operations, backend mutations, exposed credentials, or bypassed gates.
- [ ] Existing documentation/status updated with observed results and remaining limitations; WEB-M0-006 proof gates reviewed by the owner.

## Verification

Local deployment checks, before remote execution (Docker and documented build credentials required):

```bash
make validate-workflows
make test-deploy-scripts
make image
make edge-image
make web-release-smoke
make web-rollback-smoke
make integration-down
```

Always run `make integration-down` after an interrupted or failed integration run. Run the repository definition-of-done checks for any implementation fixes; passing synthetic checks does not count as VPS proof.

Non-production GitHub Actions: select `Protected medical web release`, branch `main`, and use the exact deploy/rollback inputs in requirements 8–9; run non-production without a separate reviewer; production approval remains required.

On the administrator's machine, set `SITE_ORIGIN` locally to the approved HTTPS origin (no trailing slash), then check after A, B, and rollback:

```bash
curl --fail --silent --show-error "$SITE_ORIGIN/healthz"
curl --fail --silent --show-error "$SITE_ORIGIN/system-status"
curl --fail --silent --show-error "$SITE_ORIGIN/api/v1/system/status"
curl --fail --silent --show-error --head "$SITE_ORIGIN/healthz"
```

Inspect results locally without copying real responses into task documentation. Confirm API status/version in raw HTML, reviewed HTTPS headers, successful workflow checks, restored release identity, and the read-only backend before/after comparison.

## Security and privacy

Non-production only; existing backend availability must be preserved. Host installation, ingress changes, publishing permissions, and environment protection changes require concrete human review. Non-production deploy/rollback requires manual dispatch without a separate approver; production requires protected approval. No real patient data or production credentials are needed. Preserve network and Caddy volumes; never run production-shaped `down --volumes` or delete deployment state to bypass a failure.

## Handoff

Report the deployed/restored release identifiers, protected workflow outcomes, API compatibility result, unchanged backend evidence, and all blockers/unexecuted checks without sensitive host values. Include short Local and Non-production VPS verification steps under the repository reporting rules.
