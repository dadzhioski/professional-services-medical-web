import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-credentials/actions", () => ({ addCredentialEvidence: vi.fn(), removeCredentialEvidence: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/credentials", () => ({ readCredentials: vi.fn() }));
import type { Credential } from "@/lib/api/credentials";
import { readCredentials } from "@/lib/api/credentials";
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
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
const render = async (locale = "en", outcome?: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ evidence: outcome }) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080|@/;
const signedIn = (credentials: Credential[]) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readCredentials).mockResolvedValue({ state: "ready", credentials });
};

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders private evidence with owner-only delivery and noindex metadata server-side`, async () => {
    const t = translator(locale);
    signedIn([credential]);
    const html = await render(locale);
    expect(html).toContain(t("evidence.heading"));
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
    expect(metadata).toEqual({ title: t("evidence.heading"), robots: { index: false, follow: false } });
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
