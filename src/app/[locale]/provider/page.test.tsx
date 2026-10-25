import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// SiteHeader is async and covered by its own tests; the stub proves each page renders it.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-account/actions", () => ({ logout: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const render = async (locale = "en") => renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders private SSR workspace and metadata without account data`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue({ state: "ready", context: {
      organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false } });
    const params = Promise.resolve({ locale });
    const html = await render(locale);
    expect(html).toContain(t("account.authenticated"));
    expect(html).toContain(t("workspace.ready"));
    expect(html).toContain(t("workspace.approval.pending"));
    expect(html).toContain(`aria-label="${t("provider.navigation")}"`);
    expect(html).toContain('id="main-content"');
    expect(html).not.toMatch(/synthetic-private-id|synthetic-private-org|synthetic-session|2099|localhost:8080/);
    expect(await generateMetadata({ params })).toMatchObject({ robots: { index: false, follow: false } });
  });
}
test("existing account without a workspace links to onboarding", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  const html = await render();
  expect(html).toContain(translator("en")("workspace.missing"));
  expect(html).toContain('href="/en/provider/onboarding"');
});
test.each([["APPROVED", "workspace.approval.approved"], ["REJECTED", "workspace.approval.rejected"], ["NEW_STATE", "workspace.approval.unknown"]] as const)(
  "presents API approval %s and restriction without inventing permissions", async (approvalState, key) => {
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue({ state: "ready", context: { organizationId: "o", approvalState, approvalRevision: 1, suspended: true } });
    const html = await render();
    expect(html).toContain(translator("en")(key));
    expect(html).toContain(translator("en")("workspace.suspended"));
    expect(html).not.toContain("NEW_STATE");
  });
test.each<IdentityState>(["expired", "forbidden", "unavailable"])("workspace %s failure stays safe", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain('role="alert"');
  expect(html).not.toContain(translator("en")("account.authenticated"));
  expect(html).not.toContain(translator("en")("workspace.ready"));
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("renders translated %s with login navigation", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ notice: "raw-private-error" }) }));
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain(`aria-label="${translator("en")("provider.navigation")}"`);
  expect(currentContext).not.toHaveBeenCalled();
});
test("renders the site header before main", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect((await render()).startsWith('<header data-current="workspace"></header><main id="main-content"')).toBe(true);
});
