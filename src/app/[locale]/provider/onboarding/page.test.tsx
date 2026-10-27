import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// SiteHeader is async and covered by its own tests; the stub proves each page renders it.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-onboarding/actions", () => ({ startOnboarding: vi.fn() }));
vi.mock("@/features/provider-publication/actions", () => ({ resubmitApplication: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn(), readPublication: vi.fn() }));
vi.mock("@/lib/api/credentials", () => ({ readCredentials: vi.fn() }));
import type { Credential } from "@/lib/api/credentials";
import { readCredentials } from "@/lib/api/credentials";
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile, readPublication, type PublicationResult } from "@/lib/api/profile";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { dynamic, generateMetadata } from "./page";

const t = translator("en");
const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const context = (approvalState = "PENDING", extra: { suspended?: boolean; rejectionReason?: string } = {}) =>
  ({ state: "ready", context: { organizationId: "synthetic-private-org", approvalState, approvalRevision: 6, suspended: false, ...extra } }) as const;
const allParts = ["DISPLAY_NAME", "BIOGRAPHY", "SPECIALTY", "SERVICE", "PRACTICE_LOCATION", "APPROVED_CREDENTIAL"];
const publication = (missing: string[], extra: { approved?: boolean; suspended?: boolean; publicationState?: string } = {}) =>
  ({ state: "ready", publication: { approved: false, suspended: false, publicationState: "DRAFT", version: 3, missing, ...extra } }) as unknown as PublicationResult;
const credentials = (...states: string[]) => ({ state: "ready", credentials: states.map(state => ({ credentialId: "c", version: 1,
  title: "Synthetic private licence", issuer: "i", type: "LICENSE", state, issuedOn: new Date("2020-01-01"), evidenceMediaIds: [] }) as unknown as Credential) }) as const;

function signedIn(reads: { context?: Awaited<ReturnType<typeof currentContext>>; publication?: PublicationResult;
  profile?: Awaited<ReturnType<typeof readProfile>>; credentials?: Awaited<ReturnType<typeof readCredentials>> } = {}) {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(reads.context ?? context());
  vi.mocked(readPublication).mockResolvedValue(reads.publication ?? publication(allParts));
  vi.mocked(readProfile).mockResolvedValue(reads.profile ?? { state: "ready", profile: { slug: "synthetic-slug", version: 3 } });
  vi.mocked(readCredentials).mockResolvedValue(reads.credentials ?? credentials());
}
const render = async (locale = "en", query: { notice?: string; approval?: string } = {}) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
const show = (html: string) => { document.body.innerHTML = html; return document; };
// The list item for one step, by its translated name.
const item = (html: string, key: Parameters<typeof t>[0]) =>
  [...show(html).querySelectorAll("#checklist-heading + ol > li")].find(li => li.querySelector("h3")?.textContent === t(key))!;
const next = (html: string) => show(html).querySelector("section[aria-labelledby=next-step-heading]")!;
const axeClean = async (html: string) => {
  show(html);
  expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { document.body.innerHTML = ""; });

for (const locale of localeCodes) {
  test(`${locale} first visit renders the create form, no step links and private metadata`, async () => {
    const tl = translator(locale);
    signedIn({ context: { state: "notOnboarded" } });
    const html = await render(locale);
    expect(html).toContain(tl("onboarding.heading"));
    for (const key of ["onboarding.step.workspace", "onboarding.step.profile", "onboarding.step.service", "onboarding.step.location",
      "onboarding.step.credentials", "onboarding.step.photo", "onboarding.step.review", "onboarding.step.publication"] as const) {
      expect(html).toContain(tl(key));
    }
    expect(html).toContain(tl("onboarding.privacy"));
    expect(html).toMatch(new RegExp(`<button[^>]*type="submit"[^>]*>${tl("onboarding.create")}</button>`));
    expect(html).not.toContain(tl("onboarding.state.done"));
    expect(show(html).querySelectorAll("#checklist-heading + ol a, section[aria-labelledby=next-step-heading] a")).toHaveLength(0);
    expect(html).not.toMatch(/<input|<textarea|<select/);
    expect(html).not.toMatch(/synthetic-private|synthetic-session|localhost:8080|2099/);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(show(html).querySelector('li[aria-current="step"] h3')?.textContent).toBe(tl("onboarding.step.workspace"));
    expect(await generateMetadata({ params: Promise.resolve({ locale }) })).toMatchObject({ title: tl("onboarding.heading"), robots: { index: false, follow: false } });
    await axeClean(html);
  });
}

test("reads run in parallel with the session and the page is never cached", async () => {
  signedIn();
  await render();
  expect(dynamic).toBe("force-dynamic");
  for (const read of [currentContext, readPublication, readProfile, readCredentials]) expect(read).toHaveBeenCalledWith("synthetic");
});

test("a partially complete checklist marks done steps, one current step and why later steps wait", async () => {
  signedIn({ publication: publication(["BIOGRAPHY", "PRACTICE_LOCATION", "APPROVED_CREDENTIAL"]), credentials: credentials("DRAFT") });
  const html = await render();
  expect(html).toContain(t("account.authenticated"));
  expect(item(html, "onboarding.step.workspace").textContent).toContain(t("workspace.ready"));
  expect(item(html, "onboarding.step.workspace").textContent).toContain(t("onboarding.state.done"));
  const profile = item(html, "onboarding.step.profile");
  expect(profile.getAttribute("aria-current")).toBe("step");
  expect(profile.textContent).toContain(t("onboarding.state.current"));
  expect(next(html).textContent).toContain(t("publication.missing.biography"));
  expect(next(html).textContent).not.toContain(t("publication.missing.displayName"));
  expect(next(html).querySelector('a[href="/en/provider/profile"]')?.textContent).toBe(`${t("onboarding.action.open")}: ${t("onboarding.step.profile")}`);
  expect(item(html, "onboarding.step.service").querySelector('a[href="/en/provider/services"]')?.textContent).toContain(t("onboarding.action.edit"));
  expect(item(html, "onboarding.step.location").textContent).toContain(t("onboarding.state.todo"));
  expect(item(html, "onboarding.step.credentials").textContent).toContain(t("onboarding.credential.submit"));
  expect(item(html, "onboarding.step.photo").textContent).toContain(t("onboarding.state.optional"));
  expect(item(html, "onboarding.step.publication").textContent).toContain(t("onboarding.reason.completeAbove"));
  expect(item(html, "onboarding.step.publication").querySelector("a")).toBeNull();
  expect(show(html).querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  expect(html).not.toContain("Synthetic private licence");
  await axeClean(html);
});

test("no profile yet makes the profile step current", async () => {
  signedIn({ publication: { state: "missing" }, profile: { state: "missing" } });
  const html = await render();
  expect(item(html, "onboarding.step.profile").getAttribute("aria-current")).toBe("step");
  expect(item(html, "onboarding.step.service").textContent).toContain(t("onboarding.state.todo"));
});

test("in review: the review step is current without an action and publication waits for approval", async () => {
  signedIn({ publication: publication([]) });
  const html = await render();
  expect(next(html).textContent).toContain(t("onboarding.review.pending"));
  expect(next(html).textContent).toContain(t("workspace.approval.pending"));
  expect(next(html).querySelector("a, form")).toBeNull();
  expect(item(html, "onboarding.step.publication").textContent).toContain(t("onboarding.reason.waitingApproval"));
});

test("rejected: the feedback is inert text and the resubmit form carries the revision", async () => {
  signedIn({ context: context("REJECTED", { rejectionReason: "<script>alert(1)</script>Synthetic feedback" }), publication: publication([]) });
  const html = await render();
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;Synthetic feedback");
  expect(next(html).textContent).toContain(t("workspace.feedback"));
  expect(next(html).querySelector('input[name="revision"]')?.getAttribute("value")).toBe("6");
  expect(html.match(new RegExp(t("workspace.resubmit"), "g"))).toHaveLength(1);
  await axeClean(html);
});

test("rejected with earlier steps open still shows feedback and resubmission in the review step", async () => {
  signedIn({ context: context("REJECTED", { rejectionReason: "Synthetic feedback" }) });
  const html = await render();
  const review = item(html, "onboarding.step.review");
  expect(review.textContent).toContain("Synthetic feedback");
  expect(review.querySelector('input[name="revision"]')).not.toBeNull();
  expect(html.match(new RegExp(t("workspace.resubmit"), "g"))).toHaveLength(1);
});

test("approved and eligible links to the publication page", async () => {
  signedIn({ context: context("APPROVED"), publication: publication([], { approved: true }) });
  const html = await render();
  expect(item(html, "onboarding.step.review").textContent).toContain(t("onboarding.state.done"));
  expect(next(html).querySelector('a[href="/en/provider/publication"]')).not.toBeNull();
});

test("published shows every step done with view and edit links", async () => {
  signedIn({ context: context("APPROVED"), publication: publication([], { approved: true, publicationState: "PUBLISHED" }),
    profile: { state: "ready", profile: { slug: "synthetic-slug", version: 3, photoMediaId: "0a6b1c2d-0000-4000-8000-000000000009" } } });
  const html = await render();
  expect(next(html).textContent).toContain(t("onboarding.allDone"));
  expect(show(html).querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  expect(item(html, "onboarding.step.publication").querySelector("a")?.textContent).toContain(t("onboarding.action.view"));
  expect(item(html, "onboarding.step.photo").querySelector('a[href="/en/provider/profile#photo"]')).not.toBeNull();
  await axeClean(html);
});

test("published without the optional photo is complete", async () => {
  signedIn({ context: context("APPROVED"), publication: publication([], { approved: true, publicationState: "PUBLISHED" }) });
  const html = await render();
  expect(next(html).textContent).toContain(t("onboarding.allDone"));
  expect(item(html, "onboarding.step.photo").textContent).toContain(t("onboarding.state.optional"));
});

// Every scenario renders server-side in every locale with its translated state and no raw values.
for (const locale of localeCodes) {
  test.each([
    ["partial", { publication: publication(["SERVICE"]) }, "onboarding.state.current"],
    ["in review", { publication: publication([]) }, "onboarding.review.pending"],
    ["rejected", { context: context("REJECTED", { rejectionReason: "Synthetic feedback" }), publication: publication([]) }, "workspace.resubmit"],
    ["approved", { context: context("APPROVED"), publication: publication([], { approved: true }) }, "onboarding.step.publication"],
    ["published", { context: context("APPROVED"), publication: publication([], { approved: true, publicationState: "PUBLISHED" }) }, "onboarding.allDone"],
    ["suspended", { context: context("PENDING", { suspended: true }), publication: publication([], { suspended: true }) }, "workspace.suspended"],
    ["read failure", { publication: { state: "unavailable" } as PublicationResult }, "onboarding.reason.unavailable"],
  ] as const)(`${locale}: %s`, async (_name, reads, key) => {
    signedIn(reads);
    const html = await render(locale);
    expect(html).toContain(translator(locale)(key));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).not.toMatch(/synthetic-private|PENDING|APPROVED|REJECTED|PUBLISHED/);
  });
  test(`${locale}: signed out`, async () => {
    vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
    expect(await render(locale)).toContain(translator(locale)("account.signedOut"));
  });
}

test("suspended shows the notice and offers neither resubmission nor publication", async () => {
  signedIn({ context: context("REJECTED", { suspended: true, rejectionReason: "Synthetic feedback" }), publication: publication([], { suspended: true }) });
  const html = await render();
  expect(html).toContain(t("workspace.suspended"));
  expect(html).not.toContain(t("workspace.resubmit"));
  expect(next(html).textContent).toContain(t("onboarding.noNext"));
  expect(item(html, "onboarding.step.review").textContent).toContain(t("onboarding.reason.suspended"));
  expect(show(html).querySelector('section a[href="/en/provider/publication"]')).toBeNull();
});

test.each<["publication" | "profile" | "credentials", IdentityState]>([["publication", "unavailable"], ["profile", "expired"],
  ["credentials", "forbidden"]])("a failed %s read (%s) alerts and never shows the affected steps as done", async (read, state) => {
  signedIn({ publication: publication([]), [read]: { state } });
  const html = await render();
  expect(show(html).querySelector('[role="alert"]')?.textContent).toBe(t(`account.${state}`));
  expect(html).not.toContain(t("account.authenticated"));
  const affected = read === "publication" ? ["onboarding.step.profile", "onboarding.step.service", "onboarding.step.location",
    "onboarding.step.credentials", "onboarding.step.publication"] as const : read === "profile" ? ["onboarding.step.photo"] as const :
    ["onboarding.step.credentials"] as const;
  for (const key of affected) {
    expect(item(html, key).textContent).toContain(t("onboarding.reason.unavailable"));
    expect(item(html, key).textContent).not.toContain(t("onboarding.state.done"));
  }
  expect(html).not.toMatch(/synthetic-private-error|ResponseError/);
});

test.each<IdentityState>(["expired", "forbidden", "unavailable"])("context %s hides the form and marks every step unavailable", async state => {
  signedIn({ context: { state } });
  const html = await render("en", { notice: "unavailable" });
  expect(show(html).querySelector('[role="alert"]')?.textContent).toBe(t(`account.${state}`));
  expect(html).not.toContain(t("onboarding.create"));
  expect(html).not.toContain(t("onboarding.state.done"));
  expect(html.match(new RegExp(t("onboarding.reason.unavailable"), "g"))).toHaveLength(8);
});

test("a failed create or sign-out attempt shows the safe notice; create stays available to retry", async () => {
  signedIn({ context: { state: "notOnboarded" } });
  const failed = await render("en", { notice: "unavailable" });
  expect(failed).toContain(t("account.unavailable"));
  expect(failed).toContain(t("onboarding.create"));
  signedIn();
  const ready = await render("en", { notice: "forbidden" });
  expect(show(ready).querySelector('[role="alert"]')?.textContent).toBe(t("account.forbidden"));
  expect(ready).not.toContain(t("onboarding.create"));
});

test.each([["resubmitted", "status", "workspace.outcome.resubmitted"], ["conflict", "alert", "workspace.outcome.conflict"]] as const)(
  "resubmission outcome %s is announced as %s", async (approval, role, key) => {
    signedIn();
    const html = await render("en", { approval });
    expect(show(html).querySelector(`#approval-outcome [role="${role}"]`)?.textContent).toBe(t(key));
  });
test("unknown query values are ignored", async () => {
  signedIn();
  const html = await render("en", { approval: "raw-private-error", notice: "raw-private-error" });
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain('id="approval-outcome"');
});

test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("signed out %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render("en", { notice: "raw-private-error" });
  expect(html).toContain(t(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain(`aria-label="${t("provider.navigation")}"`);
  for (const read of [currentContext, readPublication, readProfile, readCredentials]) expect(read).not.toHaveBeenCalled();
});
test("sign-out notices reach the signed-out view", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect(await render("en", { notice: "expired" })).toContain(t("account.expired"));
});
test("renders the workspace header before main and navigation marks the checklist", async () => {
  signedIn();
  const html = await render();
  expect(html.startsWith('<header data-current="workspace"></header><main id="main-content"')).toBe(true);
  expect(show(html).querySelector(`nav[aria-label="${t("provider.navigation")}"] a[aria-current="page"]`)?.textContent).toBe(t("provider.onboarding"));
  expect(html).not.toContain('href="/en/provider"');
});
