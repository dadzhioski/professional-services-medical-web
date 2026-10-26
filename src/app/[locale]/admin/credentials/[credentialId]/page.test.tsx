import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/features/admin-review/actions", () => ({ decideCredentialAction: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async () => "/api/auth/login?returnTo=%2Fen%2Fprovider" }));
vi.mock("@/lib/api/review", () => ({ credentialForReview: vi.fn() }));
import { currentAccount } from "@/lib/api/identity";
import { credentialForReview, type ReviewCredential } from "@/lib/api/review";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const evidence = ["a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6"];
const credential: ReviewCredential = { credentialId, organizationId, revision: 3, state: "SUBMITTED", type: "LICENSE",
  title: "Synthetic licence", issuer: "Synthetic board", issuedOn: new Date(2020, 0, 15), evidenceMediaIds: evidence };
const render = async (query: { outcome?: string; decide?: string } = {}, locale = "en") =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, credentialId }), searchParams: Promise.resolve(query) }));
const reviewing = (overrides: Partial<ReviewCredential> = {}) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(credentialForReview).mockResolvedValue({ state: "ready", credential: { ...credential, ...overrides } });
};

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} shows evidence through the audited administrator route only`, async () => {
    const t = translator(locale);
    reviewing();
    const html = await render({}, locale);
    for (const [index, id] of evidence.entries()) {
      expect(html).toContain(`<img src="/api/v1/admin/media/${id}/content" alt="${t("evidence.image")} ${index + 1}" referrerPolicy="no-referrer"`);
    }
    expect(html).not.toMatch(/\/api\/v1\/media\/|_next\/image|srcSet|blob:/);
    expect(html).toContain(t("review.evidencePrivacy"));
    expect(html).toContain(`href="/${locale}/admin/doctors/${organizationId}"`);
    expect(html).toContain("?decide=approve#decision");
    expect(await generateMetadata({ params: Promise.resolve({ locale, credentialId }) }))
      .toEqual({ title: t("review.credential.heading"), robots: { index: false, follow: false } });
  });
}
test("approval confirmation carries the reviewed revision without a reason field", async () => {
  reviewing();
  const html = await render({ decide: "approve" });
  expect(html).toContain('<input type="hidden" name="revision" value="3"/>');
  expect(html).not.toContain("<textarea");
  expect(html).toContain(translator("en")("review.separation"));
});
test("rejection confirmation requires a reason", async () => {
  reviewing();
  expect(await render({ decide: "reject" })).toMatch(/<textarea[^>]*name="reason"[^>]*required/);
});
test.each(["APPROVED", "REJECTED", "DRAFT"] as const)("a %s credential offers no decision", async state => {
  reviewing({ state });
  const html = await render({ decide: "approve" });
  expect(html).not.toContain("<form");
  expect(html).not.toContain("?decide=");
  expect(html).toContain(translator("en")("review.credentialDecided"));
});
test("a credential without evidence says so", async () => {
  reviewing({ evidenceMediaIds: [] });
  expect(await render()).toContain(translator("en")("evidence.noEvidence"));
});
test("an unknown credential is not found", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(credentialForReview).mockResolvedValue({ state: "notFound" });
  await expect(render()).rejects.toThrow("not-found");
});
test("a denied administrator sees no evidence", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(credentialForReview).mockResolvedValue({ state: "forbidden" });
  const html = await render();
  expect(html).toContain(translator("en")("admin.denied"));
  expect(html).not.toContain("<img");
});
test("an expired session gets login navigation", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "expired" });
  expect(await render()).toContain(translator("en")("account.expired"));
  expect(credentialForReview).not.toHaveBeenCalled();
});
