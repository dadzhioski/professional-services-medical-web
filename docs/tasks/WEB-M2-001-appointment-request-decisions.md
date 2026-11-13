# WEB-M2-001: Resolve appointment-request experience, privacy and signed-link decisions

- **Status:** PLANNED (drafted 2026-11-13); owner decisions not recorded
- **Target repository:** `professional-services-medical-web`
- **Depends on:** None
- **Related ADRs:** WEB-ADR-0001, WEB-ADR-0004, WEB-ADR-0005, [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md); creates WEB-ADR-0007 (Proposed)
- **Cross-repository dependency:** API Milestone 2 tasks, not yet created (see [Milestone 2](../backlog/milestone-2.md#api-work-to-request)). Decisions only; no API changes.
- **Risk:** Medium

## Goal

Record the decisions needed to build the appointment-request experience without inventing product, privacy or security policy.

## Allowed scope

- This task file, a new `docs/adr/WEB-ADR-0007-*.md` (Proposed) with its row in `docs/adr/README.md`, and updates to `docs/backlog/milestone-2.md` and `build-plan.md` section 11 style notes.

## Non-goals

- No source, translations, configuration, dependency, Caddy, CI or deployment change.
- No API source or task edits; no decision made on behalf of the owner or the API owner.

## Decisions to record

Each entry states the question and a proposed default. The owner's answer is recorded after it; an unanswered item blocks only the tasks named.

1. **Milestone 2 authorization.** Whether Milestone 2 planning and implementation may start while Milestone 0 and Milestone 1 acceptance stay open. *Blocks: all.*
2. **Request fields.** Proposed: visitor name, one or both of email and phone, a service chosen from the doctor's published list (optional), a location when the doctor has more than one, preferred days or time of day as fixed choices, and no free-text field. If the owner wants a free-text note, decide its length limit and the adjacent wording that tells visitors not to describe symptoms or conditions. *Blocks: 002, 004.*
3. **Consent.** The exact consent statement, whether it is one required unticked checkbox, what it links to (privacy notice page: who writes it and where it lives), and whether the confirmation states how long the data is kept. Legal copy is supplied by the owner, not written by an agent. *Blocks: 002, 004.*
4. **Route map.** Proposed: form at `/[locale]/doctors/[slug]/request`; confirmation rendered by the same route after submission, with no personal data in the URL; signed pages under `/[locale]/requests/…`; provider pages at `/[locale]/provider/requests` and `/[locale]/provider/requests/[requestId]`. Decide whether unprefixed email links redirect to `mk` like other bare product paths. *Blocks: 004–007.*
5. **Signed links.** Where the token travels (path segment proposed), that `GET` only displays and every state change is a confirmed `POST`, the page's referrer policy (`no-referrer` proposed), `noindex` and `no-store`, what an expired or already-used link shows, and that tokens never appear in logs, metadata, canonical or language-alternate links. *Blocks: 005, 007.*
6. **Email language and links.** Which locale an email and its links use (the locale of the page the request was submitted from is proposed) and how the web route shapes are communicated to the API. *Blocks: 005–007.*
7. **Visitor address for rate limits.** The web submits server-side, so the API sees the web container, not the visitor. Decide with the API owner how limits are keyed: for example a single trusted forwarded header set by the web from the address Caddy supplies. This changes forwarded-header trust and needs boundary tests and human review. *Blocks: 004.*
8. **Abuse protection at the web.** Proposed: a hidden honeypot field and a minimum fill time checked server-side, no CAPTCHA and no third-party script. A CAPTCHA would need a separate approval for the script, cookies and privacy impact. *Blocks: 004.*
9. **Call to action.** Where the request link appears (public profile only is proposed; not on directory cards), its label, and what a profile shows when the doctor does not accept requests, if the API supports that. *Blocks: 004.*
10. **Provider decisions.** Whether "propose another time" is in the first release or follows later, what a decline reason may contain (fixed choices proposed, no free text shown to the visitor), and whether the doctor sees the visitor's contact details before confirming. *Blocks: 006, 007.*
11. **Provider notification.** Whether doctors get an in-app indicator only or also email, and whether the header or checklist shows a count. *Blocks: 006.*
12. **Administrator visibility.** Proposed: administrators have no request views in this milestone. *Blocks: none if accepted.*

## Requirements

1. Inspect the pinned and latest published client and any API Milestone 2 tasks that exist by then; record observed capabilities, not assumptions.
2. Record each owner decision with its date and provenance in this file; put lasting security and privacy boundaries (signed links, forwarded address, consent handling, logging) in WEB-ADR-0007 as Proposed until reviewed.
3. List the resulting requests to the API owner in [Milestone 2](../backlog/milestone-2.md#api-work-to-request) and replace the placeholders there with real task links once they exist.
4. Keep the data scope in AGENTS.md: nothing in the decisions may solicit diagnoses, symptoms or other detailed medical data.

## Acceptance criteria

- [ ] Every decision above has a recorded owner answer or is explicitly left open with the tasks it blocks.
- [ ] WEB-ADR-0007 exists as Proposed and is listed in the ADR index.
- [ ] The backlog's dependencies and API requests match the recorded decisions.
- [ ] No Milestone 0 or Milestone 1 obligation is marked passed or waived.

## Verification

```powershell
git diff --check
```

Local runtime and non-production VPS checks are not applicable to this documentation task.

## Security and privacy

This task decides how visitor contact data, consent and bearer-style signed links are handled, and proposes a forwarded-header trust change. All of these need owner approval and human review before dependent implementation.

## Handoff

Follow AGENTS.md final-response limits. Report open decisions and the tasks each one blocks.
