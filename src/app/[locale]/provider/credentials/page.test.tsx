import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// SiteHeader is async and covered by its own tests; the stub proves each page renders it.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-credentials/actions", () => ({ addCredentialEvidence: vi.fn(), removeCredentialEvidence: vi.fn(),
  saveCredential: vi.fn(), submitCredential: vi.fn(), removeCredential: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/credentials", () => ({ readCredentials: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
import type { Credential } from "@/lib/api/credentials";
import { readCredentials } from "@/lib/api/credentials";
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false } } as const;
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const evidence = ["a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6"];
const credential: Credential = { credentialId, version: 2, state: "SUBMITTED", type: "LICENSE", title: '<script>alert("synthetic")</script>',
  issuer: "Synthetic board", issuedOn: new Date("2020-01-15"), evidenceMediaIds: evidence,
  rejectionReason: "synthetic-private-feedback" };
type Query = { evidence?: string; credential?: string; edit?: string; remove?: string };
const render = async (locale = "en", outcome?: string, query: Query = {}) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ evidence: outcome, ...query }) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080|@/;
const signedIn = (credentials: Credential[]) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readCredentials).mockResolvedValue({ state: "ready", credentials });
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { slug: "dr-0000abcd", publicationState: "UNPUBLISHED", version: 1 } });
};

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders private evidence with owner-only delivery and noindex metadata server-side`, async () => {
    const t = translator(locale);
    signedIn([credential]);
    const html = await render(locale);
    expect(html).toContain(t("credentials.heading"));
    expect(html).toContain(t("credentials.privacy"));
    expect(html).toContain(t("evidence.privacy"));
    expect(html).toContain(t("evidence.revision"));
    expect(html).toContain(t("credential.type.license"));
    expect(html).toContain(t("credential.state.submitted"));
    for (const [index, id] of evidence.entries()) {
      expect(html).toContain(`<img src="/api/v1/media/${id}/content" alt="${t("evidence.image")} ${index + 1}"`);
    }
    expect(html).toContain(`aria-label="${t("evidence.remove")}: ${t("evidence.image")} 1, &lt;script&gt;`);
    expect(html).toMatch(new RegExp(`<label for="evidence-${credentialId}"[^>]*>${t("media.file")}: &lt;script&gt;`));
    expect(html).not.toContain("<script>alert");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toMatch(/_next\/image|srcSet|blob:/);
    expect(html.replace(/\/api\/auth\/login[^"]*/g, "")).not.toMatch(privateValues);
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata).toEqual({ title: t("credentials.heading"), robots: { index: false, follow: false } });
  });
}
test("a full credential offers removal but no further upload", async () => {
  const ids = ["c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7", "d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9"];
  signedIn([{ ...credential, evidenceMediaIds: [...evidence, ...ids] }]);
  const html = await render();
  expect(html).toContain(translator("en")("evidence.full"));
  expect(html).not.toContain('type="file"');
  expect(html.match(/name="mediaId"/g)).toHaveLength(5);
});
test("a credential without evidence and an empty list render safe guidance", async () => {
  signedIn([{ ...credential, evidenceMediaIds: [] }]);
  const html = await render();
  expect(html).toContain(translator("en")("evidence.noEvidence"));
  expect(html).toContain(translator("en")("evidence.add"));
  signedIn([]);
  expect(await render()).toContain(translator("en")("evidence.none"));
});
test.each([["saved", "status", "evidence.saved"], ["full", "alert", "evidence.full"], ["missing", "alert", "evidence.missingCredential"],
  ["unsupported", "alert", "media.unsupported"]] as const)("outcome %s is announced as %s", async (outcome, role, key) => {
  signedIn([credential]);
  expect(await render("en", outcome)).toMatch(new RegExp(`role="${role}"[^>]*>${translator("en")(key)}`));
});
test("unknown outcomes are ignored", async () => {
  signedIn([credential]);
  const html = await render("en", "<b>raw-private-error</b>");
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain('id="evidence-outcome"');
});
test("no workspace links to onboarding without calling the credentials API", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  expect(await render()).toContain('href="/en/provider/onboarding"');
  expect(readCredentials).not.toHaveBeenCalled();
});
test.each<IdentityState>(["expired", "forbidden", "unavailable"])("credentials %s shows a safe notice without evidence", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readCredentials).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).not.toMatch(/<img|type="file"/);
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toMatch(/<img|type="file"/);
  expect(currentContext).not.toHaveBeenCalled();
  expect(readCredentials).not.toHaveBeenCalled();
});
test("renders the site header before main", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect((await render()).startsWith('<header data-current="none"></header><main id="main-content"')).toBe(true);
  // Without images, so React has no image preload links to place first.
  signedIn([{ ...credential, evidenceMediaIds: [] }]);
  expect((await render()).startsWith('<header data-current="none"></header><main id="main-content"')).toBe(true);
});

const t = translator("en");
const named = { ...credential, title: "Synthetic licence" };
test("a rejected credential shows owner feedback as text, the next step and resubmission", async () => {
  signedIn([{ ...named, state: "REJECTED", rejectionReason: "<b>Synthetic feedback</b>" }]);
  const html = await render();
  expect(html).toContain(t("credential.state.rejected"));
  expect(html).toContain(t("credentials.explain.rejected"));
  expect(html).toContain(`<h4 class="font-semibold">${t("credentials.feedback")}</h4>`);
  expect(html).toContain("&lt;b&gt;Synthetic feedback&lt;/b&gt;");
  expect(html).toContain(`aria-label="${t("credentials.submit")}: Synthetic licence"`);
});
test.each(["SUBMITTED", "APPROVED", "DRAFT"])("%s credentials never show feedback", async state => {
  signedIn([{ ...named, state: state as Credential["state"], rejectionReason: "Synthetic feedback" }]);
  const html = await render();
  expect(html).not.toContain("Synthetic feedback");
  expect(html).not.toContain(t("credentials.feedback"));
});
test.each([["DRAFT", true], ["REJECTED", true], ["SUBMITTED", false], ["APPROVED", false], ["UNKNOWN", false]] as const)(
  "%s offers submission: %s", async (state, offered) => {
    signedIn([{ ...named, state: state as Credential["state"] }]);
    expect((await render()).includes(`${t("credentials.submit")}: Synthetic licence`)).toBe(offered);
  });
test("a draft without evidence explains why it cannot be submitted yet", async () => {
  signedIn([{ ...named, state: "DRAFT", evidenceMediaIds: [] }]);
  const html = await render();
  expect(html).toContain(t("credentials.evidenceRequired"));
  expect(html).not.toContain(`${t("credentials.submit")}: Synthetic licence`);
});
test("the list links to editing and removal, adds credentials and shows the API's publication status", async () => {
  signedIn([named]);
  const html = await render();
  expect(html).toContain(`href="/en/provider/credentials?edit=${credentialId}#credential-edit-heading"`);
  expect(html).toContain(`href="/en/provider/credentials?remove=${credentialId}#credential-remove"`);
  expect(html).toContain(t("credentials.add"));
  expect(html).toContain(t("credentials.create"));
  expect(html).toContain(t("profileEditor.publication.unpublished"));
  expect(html).toContain(new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(credential.issuedOn));
  expect(html).toContain(t("credentials.noExpiry"));
});
test("editing a reviewed credential warns that it returns to draft and prefills the current values", async () => {
  signedIn([{ ...named, state: "APPROVED", issuedOn: new Date(2020, 0, 15), expiresOn: new Date(2030, 0, 15) }]);
  const html = await render("en", undefined, { edit: credentialId });
  expect(html).toContain(t("credentials.editHeading"));
  expect(html).toContain(t("credentials.reviewedEditNote"));
  expect(html).toContain('value="2020-01-15"');
  expect(html).toContain('value="2030-01-15"');
  expect(html).toContain('<option value="LICENSE" selected="">');
  // The add form is replaced while editing.
  expect(html).not.toContain(t("credentials.create"));
});
test("removal is confirmed on the server-rendered page", async () => {
  signedIn([named]);
  const html = await render("en", undefined, { remove: credentialId });
  expect(html).toContain(t("credentials.removeHeading"));
  expect(html).toContain(t("credentials.removeNote"));
  expect(html).toContain(t("records.removeConfirm"));
});
test.each([{ edit: "unknown" }, { remove: "unknown" }])("an unknown target %o reports a missing credential", async query => {
  signedIn([named]);
  const html = await render("en", undefined, query);
  expect(html).toMatch(new RegExp(`role="alert"[^>]*>${t("credentials.missing")}`));
  expect(html).not.toContain(t("credentials.editHeading"));
  expect(html).not.toContain(t("credentials.removeHeading"));
});
test.each([["created", "status"], ["submitted", "status"], ["evidenceRequired", "alert"], ["conflict", "alert"]] as const)(
  "credential outcome %s is announced as %s", async (outcome, role) => {
    signedIn([named]);
    const key = ({ created: "credentials.created", submitted: "credentials.submitted", evidenceRequired: "credentials.evidenceRequired",
      conflict: "credentials.conflict" } as const)[outcome];
    expect(await render("en", undefined, { credential: outcome })).toMatch(new RegExp(`role="${role}"[^>]*>${t(key)}`));
  });
test("unknown credential outcomes are ignored", async () => {
  signedIn([named]);
  const html = await render("en", undefined, { credential: "<b>raw-private-error</b>" });
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain('id="credential-outcome"');
});
test("at the credential limit the add form is replaced by guidance", async () => {
  signedIn(Array.from({ length: 20 }, (_, index) => ({ ...named, credentialId: `${credentialId.slice(0, -2)}${String(index).padStart(2, "0")}` })));
  const html = await render();
  expect(html).toContain(t("credentials.limit"));
  expect(html).not.toContain(t("credentials.create"));
});
