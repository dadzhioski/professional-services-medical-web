import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Credential } from "@/lib/api/credentials";
import type { PublicationResult } from "@/lib/api/profile";
import type { IdentityState } from "@/lib/api/session-transport";
import { onboardingProgress, type ProgressReads, type Step } from "./progress";

const allParts = ["DISPLAY_NAME", "BIOGRAPHY", "SPECIALTY", "SERVICE", "PRACTICE_LOCATION", "APPROVED_CREDENTIAL"];
const context = (approvalState = "PENDING", suspended = false) =>
  ({ state: "ready", context: { organizationId: "synthetic-org", approvalState, approvalRevision: 2, suspended } }) as const;
const publication = (missing: string[], extra: Partial<{ approved: boolean; suspended: boolean; publicationState: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" }> = {}) =>
  ({ state: "ready", publication: { approved: false, suspended: false, publicationState: "DRAFT", version: 3, missing, ...extra } }) as Extract<PublicationResult, { state: "ready" }>;
const profile = (photoMediaId?: string) => ({ state: "ready", profile: { slug: "synthetic", version: 3, photoMediaId } }) as const;
const credential = (state: string) => ({ credentialId: "c", version: 1, title: "t", issuer: "i", type: "LICENSE", state,
  issuedOn: new Date("2020-01-01"), evidenceMediaIds: [] }) as unknown as Credential;
const credentials = (...states: string[]) => ({ state: "ready", credentials: states.map(credential) }) as const;
const reads = (overrides: Partial<ProgressReads> = {}): ProgressReads =>
  ({ context: context(), publication: publication(allParts), profile: profile(), credentials: credentials(), ...overrides });

const states = (steps: Step[]) => Object.fromEntries(steps.map(step => [step.id, step.state]));
const step = (steps: Step[], id: Step["id"]) => steps.find(item => item.id === id)!;
const currents = (steps: Step[]) => steps.filter(item => item.state === "current").length;

test("before onboarding only the workspace step is current and nothing links anywhere", () => {
  const steps = onboardingProgress({ context: { state: "notOnboarded" } });
  expect(steps.map(item => item.id)).toEqual(["workspace", "profile", "service", "location", "credentials", "photo", "review", "publish"]);
  expect(states(steps)).toEqual({ workspace: "current", profile: "todo", service: "todo", location: "todo", credentials: "todo",
    photo: "todo", review: "todo", publish: "todo" });
  expect(steps.every(item => !item.page)).toBe(true);
});

test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("context %s blocks every step and nothing is done or current", state => {
  const steps = onboardingProgress({ context: { state } });
  expect(steps.every(item => item.state === "blocked" && item.reason === "onboarding.reason.unavailable")).toBe(true);
});

test("without a profile the editor steps are to do and the profile step is current", () => {
  const steps = onboardingProgress(reads({ publication: { state: "missing" }, profile: { state: "missing" } }));
  expect(states(steps)).toEqual({ workspace: "done", profile: "current", service: "todo", location: "todo", credentials: "todo",
    photo: "optional", review: "todo", publish: "blocked" });
  expect(step(steps, "publish").reason).toBe("onboarding.reason.completeAbove");
  expect(step(steps, "credentials").details).toEqual(["onboarding.credential.add"]);
});

test("profile step lists its missing parts and each part keeps only its own step open", () => {
  const steps = onboardingProgress(reads());
  expect(step(steps, "profile").details).toEqual(["publication.missing.displayName", "publication.missing.biography", "publication.missing.specialty"]);
  expect(step(steps, "profile").page).toBe("profile");
  for (const [part, id] of [["DISPLAY_NAME", "profile"], ["BIOGRAPHY", "profile"], ["SPECIALTY", "profile"], ["SERVICE", "service"],
    ["PRACTICE_LOCATION", "location"], ["APPROVED_CREDENTIAL", "credentials"]] as const) {
    const only = onboardingProgress(reads({ publication: publication([part]), credentials: credentials("DRAFT") }));
    expect(step(only, id).state).toBe("current");
    for (const other of ["profile", "service", "location", "credentials"] as const) {
      if (other !== id) expect(step(only, other).state).toBe("done");
    }
    expect(currents(only)).toBe(1);
  }
});

test.each([[[], "onboarding.credential.add"], [["DRAFT"], "onboarding.credential.submit"], [["DRAFT", "SUBMITTED"], "onboarding.credential.waiting"],
  [["REJECTED"], "onboarding.credential.rejected"], [["REJECTED", "DRAFT"], "onboarding.credential.submit"],
  [["FUTURE"], "onboarding.credential.unknown"], [["APPROVED"], "onboarding.credential.unknown"]] as const)("credentials %j explain %s", (list, key) => {
  const steps = onboardingProgress(reads({ publication: publication(["APPROVED_CREDENTIAL"]), credentials: credentials(...list) }));
  expect(step(steps, "credentials")).toMatchObject({ state: "current", details: [key] });
});

test("photo is optional, done when set and never current", () => {
  expect(step(onboardingProgress(reads()), "photo").state).toBe("optional");
  expect(step(onboardingProgress(reads({ profile: profile("0a6b1c2d-0000-4000-8000-000000000009") })), "photo")).toMatchObject({ state: "done", page: "profile#photo" });
  const complete = onboardingProgress(reads({ publication: publication([]) }));
  expect(step(complete, "photo").state).toBe("optional");
  expect(step(complete, "review").state).toBe("current");
});

test("pending review is current with nothing left above, and publication waits for approval", () => {
  const steps = onboardingProgress(reads({ publication: publication([]) }));
  expect(step(steps, "review")).toMatchObject({ state: "current", details: ["onboarding.review.pending"] });
  expect(step(steps, "publish")).toMatchObject({ state: "blocked", reason: "onboarding.reason.waitingApproval" });
  expect(currents(steps)).toBe(1);
});

test("rejected review shows its detail and stays to do while earlier steps are open", () => {
  expect(step(onboardingProgress(reads({ context: context("REJECTED") })), "review")).toMatchObject({ state: "todo", details: ["onboarding.review.rejected"] });
  expect(step(onboardingProgress(reads({ context: context("REJECTED"), publication: publication([]) })), "review").state).toBe("current");
});

test("unknown approval state is never done", () => {
  const steps = onboardingProgress(reads({ context: context("FUTURE"), publication: publication([], { approved: true }) }));
  expect(step(steps, "review")).toMatchObject({ state: "current", details: ["workspace.approval.unknown"] });
  expect(step(steps, "publish").state).toBe("todo");
});

test("approved and eligible makes publication current with its page", () => {
  const steps = onboardingProgress(reads({ context: context("APPROVED"), publication: publication([], { approved: true }) }));
  expect(states(steps)).toMatchObject({ review: "done", publish: "current" });
  expect(step(steps, "publish").page).toBe("publication");
});

test.each(["DRAFT", "UNPUBLISHED"] as const)("%s approved profile can be published", publicationState => {
  expect(step(onboardingProgress(reads({ context: context("APPROVED"), publication: publication([], { approved: true, publicationState }) })), "publish").state)
    .toBe("current");
});

test("published is done and leaves no current step", () => {
  const steps = onboardingProgress(reads({ context: context("APPROVED"), profile: profile("0a6b1c2d-0000-4000-8000-000000000009"),
    publication: publication([], { approved: true, publicationState: "PUBLISHED" }) }));
  expect(steps.every(item => item.state === "done")).toBe(true);
});

test("approved but incomplete keeps publication blocked behind the open step", () => {
  const steps = onboardingProgress(reads({ context: context("APPROVED"), publication: publication(["SERVICE"], { approved: true }) }));
  expect(step(steps, "service").state).toBe("current");
  expect(step(steps, "publish")).toMatchObject({ state: "blocked", reason: "onboarding.reason.completeAbove" });
});

test("unknown missing parts are never done and keep publication blocked", () => {
  const steps = onboardingProgress(reads({ context: context("APPROVED"), publication: publication(["FUTURE_PART"], { approved: true }) }));
  expect(states(steps)).toMatchObject({ profile: "done", service: "done", location: "done", credentials: "done", review: "done", publish: "blocked" });
  expect(step(steps, "publish")).toMatchObject({ reason: "onboarding.reason.unavailable", details: ["publication.missing.unknown"] });
  const mixed = onboardingProgress(reads({ context: context("APPROVED"), publication: publication(["FUTURE_PART", "SERVICE"], { approved: true }) }));
  expect(step(mixed, "publish").reason).toBe("onboarding.reason.completeAbove");
  expect(currents(steps)).toBe(0);
});

test("suspension blocks review and publication without offering them", () => {
  const rejected = onboardingProgress(reads({ context: context("REJECTED", true), publication: publication([], { suspended: true }) }));
  expect(step(rejected, "review")).toMatchObject({ state: "blocked", reason: "onboarding.reason.suspended" });
  expect(currents(rejected)).toBe(0);
  const approved = onboardingProgress(reads({ context: context("APPROVED", true), publication: publication([], { approved: true, suspended: true }) }));
  expect(step(approved, "publish")).toMatchObject({ state: "blocked", reason: "onboarding.reason.suspended" });
  expect(currents(approved)).toBe(0);
});

test.each<IdentityState>(["expired", "forbidden", "unavailable"])("publication %s marks its steps unavailable, never done", state => {
  const steps = onboardingProgress(reads({ publication: { state } }));
  for (const id of ["profile", "service", "location", "credentials", "publish"] as const) {
    expect(step(steps, id)).toMatchObject({ state: "blocked", reason: "onboarding.reason.unavailable" });
  }
  expect(currents(steps)).toBe(0);
});

test("credential and profile read failures affect only their steps", () => {
  const credentialFailure = onboardingProgress(reads({ publication: publication([]), credentials: { state: "unavailable" } }));
  expect(step(credentialFailure, "credentials")).toMatchObject({ state: "blocked", reason: "onboarding.reason.unavailable" });
  expect(step(credentialFailure, "location").state).toBe("done");
  expect(currents(credentialFailure)).toBe(0);
  const profileFailure = onboardingProgress(reads({ publication: publication([]), profile: { state: "unavailable" } }));
  expect(step(profileFailure, "photo")).toMatchObject({ state: "blocked", reason: "onboarding.reason.unavailable" });
  expect(step(profileFailure, "review").state).toBe("current");
});

test("every derivation has at most one current step", () => {
  for (const approval of ["PENDING", "APPROVED", "REJECTED", "FUTURE"]) {
    for (const missing of [[], allParts, ["SERVICE"], ["FUTURE_PART"]]) {
      for (const suspended of [false, true]) {
        const steps = onboardingProgress(reads({ context: context(approval, suspended),
          publication: publication(missing, { approved: approval === "APPROVED", suspended }) }));
        expect(currents(steps)).toBeLessThanOrEqual(1);
      }
    }
  }
});
