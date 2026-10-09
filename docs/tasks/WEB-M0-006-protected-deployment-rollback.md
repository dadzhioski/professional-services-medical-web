# WEB-M0-006: Add protected web deployment and rollback

- **Status:** PLANNED
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M0-005
- **Related ADRs:** WEB-ADR-0004, WEB-ADR-0005
- **Cross-repository dependency:** A compatible API release is healthy before dependent web deployment
- **Risk:** High

## Goal

Deploy and roll back only the web/Caddy Compose project through a protected, auditable workflow without granting access to backend or database operations.

## Allowed scope

- manually triggered GitHub production workflow;
- protected `production` environment requirement;
- validation of exact web image, API client version, and expected API compatibility;
- deployment scripts for web/Caddy only;
- previous web image/configuration recording;
- bounded health, SSR, SEO-header, and API-routing verification;
- disposable non-production deploy and rollback proof;
- required server/GitHub setup documentation.

## Non-goals

- no real production execution without separate user authorization;
- no API restart, database access, migration, backend rollback, arbitrary tag, or automatic deployment on merge;
- no guarantee of zero downtime in Milestone 0.

## Requirements

1. Workflow permissions are least privilege and third-party actions are pinned by full SHA.
2. The production job requires manual trigger and protected environment approval.
3. API compatibility/routing smoke tests pass before web replacement.
4. Previous web image and relevant Caddy configuration identifier are recorded.
5. Failed health verification stops clearly and supports explicit web-only rollback.
6. Secrets are masked and never printed or embedded in the image.
7. Workflow credentials cannot operate PostgreSQL or deploy the API project.

## Acceptance criteria

- [ ] Deployment cannot run on a normal merge or without approval.
- [ ] Mutable or untested web image input is rejected.
- [ ] API-unavailable preflight blocks a dependent web release.
- [ ] Previous web release record is produced.
- [ ] Non-production deployment passes health, SSR, and routing checks.
- [ ] Non-production rollback restores the previous web release without touching API/PostgreSQL.
- [ ] Required secret names and host permissions are documented without values.

## Verification

```bash
make validate-workflows
make test-deploy-scripts
make web-release-smoke
make web-rollback-smoke
```

## Security and privacy

Deployment-sensitive. Human review is mandatory. Do not access real production credentials or domains during implementation.

## Handoff

Report workflow permissions, approval gates, required secret names, compatibility preflight, deployment evidence, rollback evidence, and every unexecuted check.
