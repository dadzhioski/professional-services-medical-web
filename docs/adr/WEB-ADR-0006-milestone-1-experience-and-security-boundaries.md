# WEB-ADR-0006: Milestone 1 experience and security boundaries

- **Status:** Accepted for identity/session and PUBLIC_ORIGIN (owner, 2026-10-16) and for media (owner, 2026-10-25, WEB-M1-008); administrator boundary review, including administrator evidence access, remains pending
- **Date:** 2026-10-16
- **Related tasks:** WEB-M1-001, WEB-M1-002, WEB-M1-003, WEB-M1-008, WEB-M1-010, WEB-M1-011, WEB-M1-012

## Context

The owner approved a multilingual medical MVP launching in Macedonia and the design scope recorded in [WEB-M1-001](../tasks/WEB-M1-001-experience-and-security-decisions.md). Installed client 0.2.0 has identity capabilities but lacks feature contracts. API-M1-003 defers MFA while later API tasks still require it for administrators. This ADR records the proposed architecture implementing owner intent; approval of its scope is not review/acceptance of this completed ADR.

## Decision

The owner explicitly accepted the identity/session and PUBLIC_ORIGIN design
during WEB-M1-003 planning and authorized implementation, including its narrowly
required CI/image/deployment configuration wiring. Implementation tests and human
boundary review remain required; this acceptance does not authorize deployment,
API operations or resolve the separate administrator gate.

On 2026-10-25 the owner accepted the media boundary below for WEB-M1-008:
owner photo and evidence previews load the API's same-origin owner content route
as image resources, with no web proxy, no image optimization or derivatives, no
object URLs and no-store delivery. Administrator evidence access stays behind the
administrator gate.

### Experience and localization

Use a build-time locale registry and separate complete typed message dictionaries under `src/lib/i18n`, initially mk (default), en, bg and sq. Use localized product routes and explicit language links as mapped in WEB-M1-001; adding a locale changes configuration/messages, not route logic. Bare product entry paths redirect to mk; unsupported locales return not-found. Operational and API routes stay unprefixed. Render the correct document language on the server and translate interface/static metadata only; provider content is supplied content, not machine-translated or duplicated into invented API fields. No language cookie or external translation service.

### Identity, sessions and CSRF

Navigate the browser to the same-origin API Google login path derived from generated request options; do not fetch a browser redirect or proxy OAuth tokens through the web. The API owns callbacks and Google secrets. Return destinations are exact allowlisted localized application paths; reject external/protocol-relative destinations and arbitrary query-derived redirects. New locale return paths require API allowlist readiness.

Use per-request server-only generated-client adapters against the fixed validated `API_INTERNAL_URL`, forwarding only the documented session cookie, never all cookies/headers. The cookie is API-owned, HttpOnly, host-only, Path=/, SameSite=Lax and Secure outside the explicit local HTTP exception. Preserve API expiry, rotation and deletion semantics. No browser SDK, web OAuth secret, shared private caching or sensitive logging.

Read-only Server Components inspect existing sessions without creating them. CSRF bootstrap and cookie-changing operations run through web handlers/actions that can propagate approved Set-Cookie headers to the browser, preserving security attributes and expiry/deletion and rejecting unexpected cookie names/domains/paths. The exact cookie name comes from the verified API contract/configuration, not a web-created alternative. Use generated raw responses where headers are needed; missing response behavior is an API dependency, not permission to invent transport contracts.

Validate the web mutation entry point against the configured public origin and framework request protection before obtaining/forwarding the session-bound CSRF token required by the API. Fail closed for missing/invalid origin or CSRF protection; forwarding a cookie or obtaining an upstream token alone does not protect the web entry point. Refresh tokens after login/logout and never reuse across users. Private responses are no-store/noindex; expired, forbidden and unavailable states use safe translations. Login navigation and API photo delivery are browser navigation/resource requests, not browser calls to the private API origin.

### Administrator policy

Owner decision on 2026-10-16: defer MFA entirely for this MVP, including administrator operations. Do not add a local extra verification step. Retain stored administrator privileges, operator-controlled bootstrap, tenant isolation and restricted audits enforced by the API; Google identity alone is not an administrator grant.

The [linked API-M1-003/004/007/008/009 tasks](../backlog/milestone-1.md#linked-api-work) must be reconciled by the API owner and compatible behavior supplied before administrator integration or administrator evidence access. The web must not bypass MFA checks still enforced upstream. This decision does not modify the sibling repository or claim its owner has completed reconciliation.

### Public origin and media

Introduce server-only `PUBLIC_ORIGIN` in dependent implementation for canonical URLs and web origin checks, never deriving authority from arbitrary Host/forwarded headers. Validate an absolute origin without credentials, path beyond `/`, query or fragment; require HTTPS outside the explicit local HTTP exception. Keep it separate from `API_INTERNAL_URL`, consistent with the site's approved API public origin, and absent from client environment objects (public canonical URLs themselves are intentionally rendered). No environment or deployment configuration is added by this ADR.

Public profile HTML, metadata and photos use no-store delivery with no shared cache. Use only the API-provided, validated same-origin publication-aware media route; reject arbitrary external/object URLs and do not add image optimization derivatives or durable public storage links. Subsequent requests must deny unpublished/suspended photos, including after earlier successful delivery. Already downloaded content cannot be recalled. Private evidence always uses authenticated authorized delivery and never appears in public metadata or previews. Missing media/eligibility capabilities block integration.

## Alternatives considered

- Fixed English-only/bilingual routing: does not satisfy the four-language launch or configuration-driven expansion.
- Runtime translation editing or locale cookies: unnecessary storage/authentication and cookie scope for this MVP.
- Browser API SDK or web-owned OAuth: duplicates the existing API identity boundary and exposes unnecessary client responsibilities.
- Host-derived canonical origin or cached public photo derivatives: permits untrusted origin data or stale revoked images.
- Web-local MFA or ignoring upstream MFA failures: conflicts with owner intent and API authorization ownership.

## Consequences

Four complete message sets and localized return-path readiness are required. Public profiles remain SSR and accessible without JavaScript; translated chrome does not promise translated provider content. No-store delivery costs repeated API/media requests but avoids application cache revocation delays. MFA deferral removes an extra administrator verification layer; role, audit and isolation controls remain mandatory, and API reconciliation remains an explicit blocker. No Milestone 0 obligation is passed or waived.

## Enforcement

- WEB-M1-002: complete locale keys, configured default, unsupported locales, language-link preservation, SSR document language, keyboard/axe and responsive synthetic presentation.
- WEB-M1-003: per-user session/CSRF isolation, missing/invalid origin and CSRF rejection, safe return allowlist, cookie propagation/rotation/deletion, expiry/logout and no sensitive output/cache; published identity compatibility and live Google checks remain separate.
- WEB-M1-008/011: same-origin delivery validation, private evidence isolation, publication/photo revocation after prior reads, no cached derivatives, and malicious text/metadata safety.
- WEB-M1-011: PUBLIC_ORIGIN validation including spoofed Host/forwarded headers, server/client boundary checks, locale canonical URLs and no-store SSR/metadata.
- WEB-M1-010/012: API-reconciled administrator policy, denied unauthorized access, stale review conflicts, suspension and multilingual end-to-end journeys.
- Boundary implementation requires reviewed tests and human review; production configuration/deployment and client upgrades retain separate approval gates.

## Revisit when

MFA is scheduled after MVP, new locales or translated provider content are introduced, runtime translation editing is needed, or a cache design can prove publication-aware revocation; amend the relevant contracts/tasks and review a superseding decision before implementation.
