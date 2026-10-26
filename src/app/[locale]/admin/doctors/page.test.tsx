import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/review", async importOriginal => ({ ...await importOriginal<object>(), doctorsForReview: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { doctorsForReview } from "@/lib/api/review";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const doctor = { organizationId, approvalState: "PENDING", registeredAt: new Date("2026-10-01T08:00:00Z"), revision: 4, suspended: false } as const;
const render = async (locale = "en", state?: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ state }) }));

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} lists doctors awaiting a decision server-side with noindex metadata`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(doctorsForReview).mockResolvedValue({ state: "ready", doctors: [doctor, { ...doctor, suspended: true }] });
    const html = await render(locale);
    expect(doctorsForReview).toHaveBeenCalledWith("synthetic", "PENDING");
    expect(html).toContain(t("review.doctors.heading"));
    expect(html).toContain(t("review.separation"));
    expect(html).toContain(`href="/${locale}/admin/doctors/${organizationId}"`);
    expect(html).toContain(t("review.suspended"));
    expect(html).toContain(`aria-current="page">${t("review.filter.pending")}`);
    expect(html).not.toMatch(/synthetic-private|localhost:8080/);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toEqual({ title: t("review.doctors.heading"), robots: { index: false, follow: false } });
  });
}
test.each([["APPROVED", "APPROVED"], ["REJECTED", "REJECTED"], ["ADMIN", "PENDING"], [undefined, "PENDING"]])(
  "filter %s reads %s", async (state, read) => {
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(doctorsForReview).mockResolvedValue({ state: "ready", doctors: [] });
    expect(await render("en", state)).toContain(translator("en")("review.doctors.none"));
    expect(doctorsForReview).toHaveBeenCalledWith("synthetic", read);
  });
test("an account the API denies sees only the denied notice", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorsForReview).mockResolvedValue({ state: "forbidden" });
  const html = await render();
  expect(html).toContain(translator("en")("admin.denied"));
  expect(html).not.toContain(translator("en")("admin.navigation"));
  expect(html).not.toContain("/en/admin/doctors/");
});
test.each<IdentityState>(["signedOut", "expired"])("%s accounts get login navigation without calling review APIs", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(doctorsForReview).not.toHaveBeenCalled();
});
test.each<IdentityState>(["expired", "unavailable"])("a review %s failure renders a safe notice", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorsForReview).mockResolvedValue({ state });
  expect(await render()).toContain(translator("en")(`account.${state}`));
});
