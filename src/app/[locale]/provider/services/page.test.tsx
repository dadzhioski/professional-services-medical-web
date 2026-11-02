import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-services/actions", () => ({ savePriceList: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/services", () => ({ listServices: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { listServices } from "@/lib/api/services";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false } } as const;
const paid = { serviceId: "svc-paid", name: "Synthetic consultation", description: '<script>alert("x")</script>',
  price: { amount: "9999999.99", currency: "EUR" as const }, locationIds: ["loc-1"], version: 2 };
const free = { serviceId: "svc-free", name: "Synthetic free check", price: { amount: "0.00", currency: "MKD" as const }, locationIds: [], version: 0 };
const unpriced = { serviceId: "svc-none", name: "Synthetic unpriced", locationIds: ["loc-gone"], version: 1 };
const render = async (query: { notice?: string } = {}, locale = "en") =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080/;
const t = translator("en");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [paid, free, unpriced] });
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { slug: "dr-0000abcd", publicationState: "UNPUBLISHED", version: 1 } });
});

for (const locale of localeCodes) {
  test(`${locale} renders the whole price list as one form with noindex metadata server-side`, async () => {
    const tr = translator(locale);
    const html = await render({}, locale);
    expect(html).toContain(tr("providerServices.heading"));
    expect(html).toContain(tr("providerServices.save"));
    expect(html).toContain(tr("providerServices.pasteHeading"));
    expect(html).toMatch(new RegExp(`<label[^>]*for="price-list-0-name"[^>]*>${tr("providerServices.name")}</label>`));
    expect(html).toContain(`<legend class="px-1 font-semibold text-teal-950">${tr("providerServices.entry")} 1</legend>`);
    expect(html).toContain(tr("profileEditor.publication.unpublished"));
    expect(html).toContain('aria-current="page"');
    expect(html).not.toMatch(privateValues);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toMatchObject({ title: tr("providerServices.heading"), robots: { index: false, follow: false } });
  });
}
test("existing entries carry their identifier and version and amounts are not rounded", async () => {
  const html = await render();
  expect(html).toContain('name="serviceId-0" value="svc-paid"');
  expect(html).toContain('name="version-0" value="2"');
  expect(html).toContain('value="9999999.99"');
  expect(html).toContain('value="0.00"');
  expect(html).toContain('name="remove-2"');
  // Three existing rows and three empty ones.
  expect(html).toContain('name="rows" value="6"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert");
  expect(html).not.toContain("loc-gone");
});
test("an empty list prefills the first examination and new rows default to denars", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [] });
  const html = await render();
  expect(html).toContain(`value="${t("providerServices.suggestedFirst")}"`);
  expect(html).toContain('<option value="MKD" selected="">MKD</option>');
  expect(html).not.toContain('name="remove-0"');
});
test("new rows use the currency the list already uses", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [paid] });
  expect((await render()).match(/<option value="EUR" selected="">/g)).toHaveLength(4);
});
test.each(["saved", "forbidden", "unavailable"])("known notice %s is translated", async notice => {
  expect(await render({ notice })).toContain(t(notice === "saved" ? "records.saved" : `account.${notice}` as never));
});
test("unknown notices are ignored", async () => {
  expect(await render({ notice: "raw-private-error" })).not.toContain("raw-private-error");
});
test.each([["saved", true], ["unavailable", false]])("notice %s links back to the checklist: %s", async (notice, linked) => {
  const html = await render({ notice });
  expect(new RegExp(`href="/en/provider/onboarding"[^>]*>${t("onboarding.backToChecklist")}</a>`).test(html)).toBe(linked);
});
test("a failed list hides the editor with a safe notice", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "unavailable" });
  const html = await render();
  expect(html).toContain(t("account.unavailable"));
  expect(html).not.toMatch(/<form|<input/);
});
test("no workspace links to onboarding without calling record APIs", async () => {
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  const html = await render();
  expect(html).toContain('href="/en/provider/onboarding"');
  expect(listServices).not.toHaveBeenCalled();
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render({ notice: "saved" });
  expect(html).toContain(t(`account.${state}`));
  expect(html).not.toContain(t("records.saved"));
  expect(currentContext).not.toHaveBeenCalled();
  expect(listServices).not.toHaveBeenCalled();
});
