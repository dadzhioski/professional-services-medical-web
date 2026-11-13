# WEB-M2-002: Build the request form and request-state presentation with synthetic content

- **Status:** PLANNED (drafted 2026-11-13)
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M2-001 decisions 2, 3, 5 and 10; WEB-M1-019 merged (design tokens and primitives)
- **Related ADRs:** WEB-ADR-0001; WEB-ADR-0007 (Proposed, from WEB-M2-001)
- **Cross-repository dependency:** None
- **Risk:** Low

## Goal

The form and state components for appointment requests exist, are accessible in all four locales and are covered by tests, before any API capability is available.

## Allowed scope

- New `src/features/appointment-request/` presentation components: the request form, the consent control, a submission confirmation panel and a request-status panel.
- Small additions to `src/components/ui` only where an existing primitive cannot express a needed control.
- Typed translation keys in mk, en, bg and sq, and component tests.

## Non-goals

- No route, Server Action, API wrapper, fixture route or link from a public page. Nothing here is reachable by visitors.
- No handwritten types that mirror an expected API DTO. Components take plain view props defined by this feature; mapping from generated types happens in WEB-M2-004 to 007.
- No new dependency, date-picker library, client-side validation library, analytics or third-party script.

## Requirements

1. The form is a plain HTML form that works without JavaScript. Fields and the consent control follow WEB-M2-001 decisions 2 and 3 exactly; if those are not recorded, stop.
2. Every control has a visible label, required fields are marked in text, and help and error text is linked with `aria-describedby`. A failed submission renders an error summary that links to each field and keeps the entered values.
3. Contact inputs use the correct `type`, `autocomplete` and `inputmode` values. Preferred time is a set of fixed choices, not a calendar.
4. The form shows a short notice that the request is not a confirmed appointment and is not for emergencies, using owner-approved copy.
5. The confirmation panel and the status panel cover every visitor-visible state agreed in WEB-M2-001 (for example submitted, confirmed, declined, another time proposed, cancelled, expired link). State is conveyed by text, not colour alone.
6. Client Components are used only where interaction needs them. The components render correctly on the server.
7. Layout holds at 320 px, targets are at least 44 px, focus is visible and there are no axe violations.
8. Tests: server-rendered output for each locale and each state, the error summary and value preservation, malicious strings rendered as inert text, and axe checks. A Playwright component-style spec may follow the pattern in `tests/e2e/presentation.spec.tsx`.

## Acceptance criteria

- [ ] Form, consent, confirmation and status components render for mk, en, bg and sq with complete dictionaries.
- [ ] No field or copy solicits symptoms, diagnoses or other detailed medical data.
- [ ] Components are not imported by any route.
- [ ] Lint, types, unit tests, production build and API-client policy pass; the pinned client is unchanged.

## Verification

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
$env:PUBLIC_ORIGIN = 'http://localhost:3000'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run e2e
git diff --check
```

**Local:** Tests only; there is no page to open. **Non-production VPS:** not applicable.

## Security and privacy

Presentation only; no data is sent or stored. The field set and consent wording are privacy decisions owned by WEB-M2-001.

## Handoff

Follow AGENTS.md final-response limits and Verify block. Report any state or field the decisions did not cover.
