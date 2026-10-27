# WEB-M1-015: Merge the provider workspace page into a guided onboarding checklist

- **Status:** APPROVED FOR IMPLEMENTATION (2026-10-27). The owner accepted the default for every decision below. Drafted from owner feedback that the workspace page only shows a status and a sign-out button, and that the onboarding checklist does not reflect completed steps.
- **Target repository:** `professional-services-medical-web`
- **Depends on:** WEB-M1-005 (onboarding and workspace), WEB-M1-006/007/008/009 (profile, services, locations, photo, credentials editors), WEB-M1-010 (approval, resubmission and publication), WEB-M1-013 (site header with workspace link and sign-out); owner decisions below
- **Related ADRs:** WEB-ADR-0001; [WEB-ADR-0006](../adr/WEB-ADR-0006-milestone-1-experience-and-security-boundaries.md) (identity/session and login return allowlist)
- **Cross-repository dependency:** None. Pinned client 0.7.0 already provides every read the checklist needs: `OrganizationApi.getCurrentContext` (`approvalState`, `rejectionReason`, `approvalRevision`, `suspended`), `ProfileApi.getProfilePublication` (`missing`, `approved`, `publicationState`, `suspended`), the profile read (`photoMediaId`) and the credential list (`state`). No client upgrade is expected.
- **Risk:** Medium

## Goal

A signed-in doctor lands on one checklist that shows, from API state, which onboarding steps are done, which one to do next and why later steps are blocked, and links straight to the page that completes each step. The separate workspace page no longer exists as a page of its own.

## Context (2026-10-27)

`/[locale]/provider` shows the account heading, the approval status, rejection feedback with resubmission, and a sign-out button. Sign-out is already in the site header (WEB-M1-013), so the page adds little. `/[locale]/provider/onboarding` lists the steps, but only "Create your private workspace" has a status; the other steps always show "Not available yet". WEB-M1-005 intentionally left those steps without status "until their tasks provide API-backed progress". Those tasks are now implemented, and the publication page already maps each `missing` part to its editor page (`src/features/provider-publication/labels.ts`).

Google sign-in returns to `/[locale]/provider` through the API's exact return allowlist (`src/lib/api/identity.ts`, WEB-ADR-0006). That path must keep working, so this task redirects it instead of removing it; no new return path or API allowlist change is needed.

## Allowed scope

- `src/app/[locale]/provider/page.tsx` (becomes a redirect) and `src/app/[locale]/provider/onboarding/page.tsx` (the checklist).
- `src/features/provider-onboarding` (checklist component, progress derivation, `ProviderNavigation`, `WorkspaceSummary` reuse or move), and redirect targets in `src/features/provider-onboarding/actions.ts`, `src/features/provider-publication/actions.ts` and `src/features/provider-account/actions.ts`.
- A "back to your checklist" link in the success notices of the profile, photo, services, locations and credentials pages, per decision 3.
- The header workspace link in `src/components/site-header.tsx` and the entry page link in `src/components/home.tsx`, only if decision 1 changes where they point.
- Typed translation keys in all four locales; removal of keys that become unused.
- Unit tests, page tests and Playwright specs for this task's requirements, including updates to `tests/e2e/onboarding.spec.ts`, `navigation.spec.ts` and `journey.spec.ts`, and fixture states in `tests/e2e/api-fixture.mjs`.

## Non-goals

- No web-owned workflow state, no cookies, local storage or client-side progress tracking; progress comes only from API reads.
- No change to what any editor page saves, validates or allows, and no change to approval, resubmission or publication rules.
- No new API calls, endpoints, DTOs or client upgrade; no change to the login return path or the API allowlist.
- No dashboard, analytics, notifications, emails or progress percentages beyond what the requirements list.
- No change to administrator pages, public pages, Caddy, CI, deployment or the session/CSRF transport.
- No API source, OpenAPI generation, database work, API deployment, pushing or pull requests unless requested.

## Owner decisions (2026-10-27)

The owner accepted the default for each decision. Each entry keeps the question and records the decision after it.

1. **Where the checklist lives.** Either `/[locale]/provider` redirects to `/[locale]/provider/onboarding`, or the checklist is rendered at `/[locale]/provider` and `/onboarding` redirects there. **Decision:** `/provider` redirects to `/provider/onboarding`, and `/provider?notice=…` / `?approval=…` carry the query to the checklist. Sign-in, the header, the entry page and bookmarks keep working.
2. **Navigation labels.** The provider navigation loses its "Workspace" link. Decide the label of the checklist link and of the header link for signed-in doctors. **Decision:** provider navigation shows "Getting started" first; the header keeps "Workspace" and leads to the checklist.
3. **Return to the checklist after saving.** **Decision:** each editor's success notice gets a "Back to your checklist" link. No progress summary is added to the editor pages, so they make no extra API reads.
4. **Step granularity.** **Decision:** one step per editor page (profile, services, location, credentials), with the missing profile parts (display name, biography, specialty) listed under the profile step. The photo stays optional and never blocks the next step.
5. **Credential detail.** `missing` only says that no approved credential exists. **Decision:** also read the credential list to show "add a credential", "submit your credential", "waiting for review" or "not approved, see feedback".

## Requirements

1. Per decision 1, `/[locale]/provider` redirects to the checklist for every locale, preserving only the known `notice` and `approval` query values; unsupported locales return not-found. The bare `/provider` operational redirect keeps working. The login return path stays `/[locale]/provider`.
2. A server-only, side-effect-free `onboardingProgress` function derives the steps from the generated DTOs of the context, publication, profile and (per decision 5) credential reads. It returns an ordered list of steps with a state of `done | current | todo | blocked | optional` and, for blocked steps, a reason key. There is exactly one `current` step, or none when everything is done. Unknown `missing` parts, approval states or credential states are never treated as done.
3. Steps, in order: create workspace; profile (display name, biography, specialty); service; practice location; credentials; photo (optional); review by the team; publish. Done means:
    - workspace: context `ready`;
    - profile, service, location, credentials: the matching parts are absent from `missing`, and a publication read exists (a 404 means no profile yet, so these steps are `todo`);
    - photo: `photoMediaId` is set;
    - review: `approvalState` is `APPROVED`. `PENDING` shows "in review" and `REJECTED` shows the rejection reason and the existing resubmit form (`WorkspaceSummary` behaviour, revision included);
    - publish: `publicationState` is `PUBLISHED`. Otherwise it is `blocked`, with "waiting for approval" or "complete the steps above", until the publication page's existing eligibility rule allows it. It then links to the publication page, which keeps the confirmation step.
4. The current step is shown in its own section with a heading and one primary link to the page that completes it. Done steps keep a secondary "Edit" or "View" link. Each step's state is written as text, not only as an icon or colour.
5. Before onboarding, the checklist shows the existing create-workspace form and privacy note; all other steps are `todo` without links. A suspended workspace shows the existing suspended notice, and no step offers an action the API would refuse.
6. Failure handling: if a read fails, the page shows a translated alert and marks the affected steps as status unavailable. It never shows them as done and never shows raw API errors. An identity failure renders the existing signed-out view.
7. The context, publication, profile and credential reads run in parallel on the server, with no shared or ISR cache. Pages stay `force-dynamic`, so a step updates on the next request after any save.
8. Redirect targets move to the checklist: workspace creation (`startOnboarding`) lands on the checklist; resubmission lands on the checklist's review step with its outcome notice (`#approval-outcome`); sign-out keeps its current destination behaviour.
9. `ProviderNavigation` drops the workspace entry and uses the label from decision 2. The header keeps sign-out. Nothing that was only reachable from the old workspace page (approval status, rejection feedback, resubmission, suspended notice) is lost.
10. Per decision 3, the success notices of the profile, photo, services, locations and credentials pages link back to the checklist.
11. Pages remain Server Components and work with JavaScript disabled. No Client Component is added beyond the existing submit button.
12. Accessibility: one `h1`; the checklist is an ordered list with the `current` step marked by text and `aria-current="step"`; visible focus, 44 px targets, 320 px layout and no new axe violations.
13. All user-visible text and metadata use typed keys with complete mk, en, bg and sq dictionaries. Keys that become unused (for example `onboarding.upcoming`) are removed from all four.
14. Tests:
    - `onboardingProgress` unit tests: every combination that matters (not onboarded, no profile yet, each missing part, photo set or not, each approval state, suspended, each publication state, unknown enum values, failed reads), with exactly one `current` step.
    - Page SSR tests for every locale: first visit, partially complete, in review, rejected with resubmission, approved and eligible, published, suspended, read failures, signed out; malicious rejection text stays inert; axe.
    - Redirect tests for `/[locale]/provider` with and without query values, and for the updated action redirects.
    - Playwright with the fixture: sign in, create the workspace, complete steps one by one with the checklist updating after each save, JavaScript disabled, keyboard and axe, desktop and Pixel 7, 320 px; the journey spec still passes end to end.
15. Read [Milestone 1](../backlog/milestone-1.md) and the [Milestone 0 deferred-work register](../backlog/milestone-0.md#deferred-work-and-milestone-1-transition-2026-10-16). Available foundation implementation is not formal Milestone 0 acceptance.

## Acceptance criteria

- [x] (owner) Decisions 1–5 recorded in this task.
- [ ] Signing in, the header workspace link, the entry page link and `/[locale]/provider` all land on the checklist.
- [ ] Each step's status reflects API state on the next request after a save, without JavaScript and without any web-stored progress.
- [ ] One clearly marked next step links to the page that completes it; blocked steps say why.
- [ ] Approval status, rejection feedback, resubmission and the suspended notice remain available on the checklist.
- [ ] Read failures never show a step as done; unknown API values are not treated as done.
- [ ] Keyboard, axe, mobile/desktop and 320 px checks pass; HTML contains no private data beyond the owner's own rejection feedback.
- [ ] Lint, types, unit tests, production build, affected browser checks and API-client policy pass; the pinned client is unchanged.
- [ ] No deferred Milestone 0 obligation is marked passed or waived.

## Verification

Use the repository's pinned toolchain and existing installed dependencies; run `npm ci` if installation is needed. For build/type generation, use an existing valid configuration or this synthetic origin (no API process is required):

```powershell
$env:API_INTERNAL_URL = 'http://127.0.0.1:9'
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:api-client-version
npm run test:policy
npm run e2e
git diff --check
```

**Local:** Use the isolated browser fixture for the scenarios above; no running API or real personal data is needed. For live checks, start `npm run dev` with existing local API configuration and a fresh synthetic Google account. Sign in from `http://localhost:3000/mk` and confirm you land on the checklist. Create the workspace, then complete the profile, a service, a location and a credential, returning to the checklist after each save and checking that the step turns done and the next step is highlighted. Approve the doctor and credential as a synthetic administrator, then reject and resubmit once, and publish. Repeat a few steps with JavaScript disabled, and with the API stopped (expect the unavailable message and no step shown as done).

**Non-production VPS:** When separately authorized and a compatible API is healthy, follow `deployment/README.md`: dispatch `Protected medical web release` (`deploy.yml`) from `main`, operation `deploy`, environment `non-production`, with the published full commit-SHA release. Repeat the local journey with synthetic accounts and check `/healthz` and `/system-status` for regressions. Record the release and any unexecuted live checks. No production deployment or API operation is authorized by this task.

## Security and privacy

All reads are made server-side with the visitor's own session through the existing wrappers; nothing is cached or shared between users. The checklist shows only the owner's own workspace state and the review feedback already visible on the workspace page. No new data is collected or stored, no PII, session values or query strings are logged, and only known query values are carried through the redirect. The login return path and allowlist are unchanged. Never solicit patient records or detailed medical information.

## Handoff

Follow AGENTS.md final-response limits and its Local/Non-production VPS Verify block; report blockers, unexecuted checks, open owner decisions and affected client/SSR/accessibility/privacy behavior. Update this task's status/checklists only from actual evidence; do not create a separate completion report.
