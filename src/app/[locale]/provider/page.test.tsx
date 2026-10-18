import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-account/actions", () => ({ logout: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders private SSR and metadata without account data`, async () => {
    vi.mocked(currentAccount).mockResolvedValue({ state: "authenticated", account: {
      accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01"),
    } });
    const params = Promise.resolve({ locale });
    const html = renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve({}) }));
    expect(html).toContain(translator(locale)("account.authenticated"));
    expect(html).toContain('id="main-content"');
    expect(html).not.toMatch(/synthetic-private-id|synthetic-session|2099|localhost:8080/);
    expect(await generateMetadata({ params })).toMatchObject({ robots: { index: false, follow: false } });
  });
}
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("renders translated %s with login navigation", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ notice: "raw-private-error" }) }));
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toContain("raw-private-error");
});
