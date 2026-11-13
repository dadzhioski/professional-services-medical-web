import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async () => "/api/auth/login?returnTo=%2Fen%2Fprovider" }));
vi.mock("@/lib/api/review", () => ({ submittedCredentials: vi.fn() }));
import { currentAccount } from "@/lib/api/identity";
import { submittedCredentials, type ReviewCredential } from "@/lib/api/review";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const credential: ReviewCredential = { credentialId, organizationId: "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60", revision: 3, state: "SUBMITTED",
  type: "LICENSE", title: "<b>Synthetic licence</b>", issuer: "Synthetic board", issuedOn: new Date(2020, 0, 15),
  submittedAt: new Date("2026-10-20T10:00:00Z"), evidenceMediaIds: ["a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5"] };
const render = async (locale = "en") => renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) }));

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} lists submitted credentials without evidence images and with noindex metadata`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(submittedCredentials).mockResolvedValue({ state: "ready", credentials: [credential] });
    const html = await render(locale);
    expect(html).toContain(t("review.credentials.heading"));
    expect(html).toContain(`href="/${locale}/admin/credentials/${credentialId}"`);
    expect(html).toContain("&lt;b&gt;Synthetic licence&lt;/b&gt;");
    expect(html).not.toContain("<img");
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toEqual({ title: t("review.credentials.heading"), robots: { index: false, follow: false } });
  });
}
test("an empty queue says so", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "ready", credentials: [] });
  expect(await render()).toContain(translator("en")("review.credentials.none"));
});
test("an account the API denies sees only the denied notice", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "forbidden" });
  const html = await render();
  expect(html).toContain(translator("en")("admin.denied"));
  expect(html).not.toContain("/en/admin/credentials/");
});
test("signed-out accounts never call the review API", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect(await render()).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(submittedCredentials).not.toHaveBeenCalled();
});
