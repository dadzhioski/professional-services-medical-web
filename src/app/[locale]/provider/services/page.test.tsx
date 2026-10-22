import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-services/actions", () => ({ saveService: vi.fn(), removeService: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/services", () => ({ listServices: vi.fn() }));
vi.mock("@/lib/api/locations", () => ({ listLocations: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { listLocations } from "@/lib/api/locations";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { listServices } from "@/lib/api/services";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", suspended: false } } as const;
const location = { locationId: "loc-1", label: "Synthetic Clinic", displayAddress: "1 Synthetic Street", cityId: "city-1", countryCode: "MK", version: 0 };
const paid = { serviceId: "svc-paid", name: "Synthetic consultation", description: '<script>alert("x")</script>',
  price: { amount: "9999999.99", currency: "EUR" as const }, locationIds: ["loc-1"], version: 2 };
const free = { serviceId: "svc-free", name: "Synthetic free check", price: { amount: "0.00", currency: "MKD" as const }, locationIds: [], version: 0 };
const unpriced = { serviceId: "svc-none", name: "Synthetic unpriced", locationIds: ["loc-gone"], version: 1 };
const render = async (query: { notice?: string; edit?: string; remove?: string } = {}, locale = "en") =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080/;
const t = translator("en");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [paid, free, unpriced] });
  vi.mocked(listLocations).mockResolvedValue({ state: "ready", records: [location] });
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { slug: "dr-0000abcd", publicationState: "UNPUBLISHED", version: 1 } });
});

for (const locale of localeCodes) {
  test(`${locale} renders the services list, add form and noindex metadata server-side`, async () => {
    const tr = translator(locale);
    const html = await render({}, locale);
    expect(html).toContain(tr("providerServices.heading"));
    expect(html).toContain(tr("providerServices.add"));
    expect(html).toMatch(new RegExp(`<label[^>]*for="service-new-name"[^>]*>${tr("providerServices.name")}</label>`));
    expect(html).toContain(tr("profileEditor.publication.unpublished"));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/' + locale + '/provider/services?edit=svc-paid#service-edit-heading"');
    expect(html).not.toMatch(privateValues);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toMatchObject({ title: tr("providerServices.heading"), robots: { index: false, follow: false } });
  });
}
test("absent and zero prices are shown distinctly and amounts are not rounded", async () => {
  const html = await render();
  expect(html).toContain("€9,999,999.99");
  expect(html).toMatch(/MKD\s0\.00|0\.00\sMKD/);
  expect(html).toContain(t("providerServices.priceNotPublished"));
  expect(html).toContain(`Synthetic Clinic, 1 Synthetic Street`);
  expect(html).toContain(t("providerServices.locationUnknown"));
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert");
});
test("an empty list shows the empty state and the missing-location hint", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [] });
  vi.mocked(listLocations).mockResolvedValue({ state: "ready", records: [] });
  const html = await render();
  expect(html).toContain(t("providerServices.empty"));
  expect(html).toContain('href="/en/provider/locations"');
});
test("edit opens a prefilled editor and hides the add form", async () => {
  const html = await render({ edit: "svc-paid" });
  expect(html).toContain(t("providerServices.editHeading"));
  expect(html).toContain('id="service-edit-name"');
  expect(html).toContain('value="Synthetic consultation"');
  expect(html).toContain('name="version" value="2"');
  expect(html).toContain('name="locationIds" checked="" value="loc-1"');
  expect(html).not.toContain('id="service-new-name"');
});
test("removal requires an explicit confirmation step", async () => {
  const html = await render({ remove: "svc-free" });
  expect(html).toContain(t("providerServices.removeHeading"));
  expect(html).toContain(t("records.removeConfirm"));
  expect(html).toContain('href="/en/provider/services">' + t("records.cancel"));
});
test.each([{ edit: "svc-foreign" }, { remove: "svc-foreign" }])("unknown identifiers are not trusted %#", async query => {
  const html = await render(query);
  expect(html).toContain(t("records.notFound"));
  expect(html).not.toContain(t("providerServices.removeHeading"));
  expect(html).not.toContain(t("providerServices.editHeading"));
});
test.each(["saved", "removed", "forbidden", "unavailable"])("known notice %s is translated", async notice => {
  expect(await render({ notice })).toContain(t(notice === "saved" ? "records.saved" : notice === "removed" ? "records.removed" : `account.${notice}` as never));
});
test("unknown notices are ignored", async () => {
  expect(await render({ notice: "raw-private-error" })).not.toContain("raw-private-error");
});
test.each<[string, () => void]>([
  ["services", () => vi.mocked(listServices).mockResolvedValue({ state: "unavailable" })],
  ["locations", () => vi.mocked(listLocations).mockResolvedValue({ state: "unavailable" })],
])("a failed %s list hides every editor with a safe notice", async (_name, fail) => {
  fail();
  const html = await render();
  expect(html).toContain(t("account.unavailable"));
  expect(html).not.toMatch(/<form|<input/);
});
test("no workspace links to onboarding without calling record APIs", async () => {
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  const html = await render();
  expect(html).toContain('href="/en/provider/onboarding"');
  expect(listServices).not.toHaveBeenCalled();
  expect(listLocations).not.toHaveBeenCalled();
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render({ notice: "saved" });
  expect(html).toContain(t(`account.${state}`));
  expect(html).not.toContain(t("records.saved"));
  expect(currentContext).not.toHaveBeenCalled();
  expect(listServices).not.toHaveBeenCalled();
});
