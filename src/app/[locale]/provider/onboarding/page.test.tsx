import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// SiteHeader is async and covered by its own tests; the stub proves each page renders it.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-onboarding/actions", () => ({ startOnboarding: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false } } as const;
const render = async (locale = "en", notice?: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ notice }) }));

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders the first-onboarding checklist and form server-side`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
    const params = Promise.resolve({ locale });
    const html = await render(locale);
    expect(html).toContain(t("onboarding.heading"));
    for (const key of ["onboarding.step.workspace", "onboarding.step.profile", "onboarding.step.photo", "onboarding.step.review", "onboarding.step.publication"] as const) {
      expect(html).toContain(t(key));
    }
    expect(html).toContain(t("onboarding.todo"));
    expect(html).not.toContain(t("onboarding.done"));
    expect(html).toMatch(new RegExp(`<button[^>]*type="submit"[^>]*>${t("onboarding.create")}</button>`));
    expect(html).not.toMatch(/<input|<textarea|<select/);
    expect(html).not.toMatch(/synthetic-private-id|synthetic-session|localhost:8080/);
    expect(await generateMetadata({ params })).toMatchObject({ title: t("onboarding.heading"), robots: { index: false, follow: false } });
  });
}
test("resume shows the existing workspace without a create form", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  const html = await render("en", "unavailable");
  const t = translator("en");
  expect(html).toContain(t("onboarding.done"));
  expect(html).toContain(t("workspace.approval.pending"));
  expect(html).toContain('href="/en/provider"');
  expect(html).not.toContain(t("onboarding.create"));
  expect(html).not.toContain(t("account.unavailable"));
  expect(html).not.toContain("synthetic-private-org");
});
test("a failed attempt shows a safe notice and allows retry", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  const html = await render("en", "unavailable");
  expect(html).toContain(translator("en")("account.unavailable"));
  expect(html).toContain(translator("en")("onboarding.create"));
  expect(html).not.toContain(translator("en")("workspace.ready"));
});
test.each<IdentityState>(["expired", "forbidden", "unavailable"])("context %s hides the form", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).not.toContain(translator("en")("onboarding.create"));
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render("en", "raw-private-error");
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toContain("raw-private-error");
  expect(html).not.toContain(translator("en")("onboarding.create"));
  expect(currentContext).not.toHaveBeenCalled();
});
test("renders the site header before main", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect((await render()).startsWith('<header data-current="none"></header><main id="main-content"')).toBe(true);
});
