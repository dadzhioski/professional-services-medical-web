import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-locations/actions", () => ({ saveLocation: vi.fn(), removeLocation: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/locations", () => ({ listLocations: vi.fn() }));
vi.mock("@/lib/api/reference", () => ({ listCountries: vi.fn(), listCities: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
import { currentAccount } from "@/lib/api/identity";
import { listLocations } from "@/lib/api/locations";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { listCities, listCountries } from "@/lib/api/reference";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", suspended: false } } as const;
const clinic = { locationId: "loc-1", label: "Synthetic Clinic", displayAddress: "1 Synthetic Street", cityId: "city-skopje", countryCode: "MK", version: 3 };
const retired = { locationId: "loc-2", displayAddress: "2 Synthetic Street", cityId: "city-retired", countryCode: "MK", version: 0 };
const countries = [{ code: "MK", labels: { mk: "Македонија", en: "North Macedonia", bg: "Северна Македония" } }, { code: "BG", labels: { en: "Bulgaria" } }];
const cities = [{ id: "city-skopje", code: "skopje", countryCode: "MK", labels: { mk: "Скопје", en: "Skopje", bg: "Скопие" } },
  { id: "city-sofia", code: "sofia", countryCode: "BG", labels: { en: "Sofia" } }];
const render = async (query: { notice?: string; edit?: string; remove?: string } = {}, locale = "en") =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
const t = translator("en");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(listLocations).mockResolvedValue({ state: "ready", records: [clinic, retired] });
  vi.mocked(listCountries).mockResolvedValue({ state: "ready", records: countries });
  vi.mocked(listCities).mockResolvedValue({ state: "ready", records: cities });
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { slug: "dr-0000abcd", publicationState: "DRAFT", version: 1 } });
});

for (const locale of localeCodes) {
  test(`${locale} renders locations with grouped reference choices and noindex metadata`, async () => {
    const tr = translator(locale);
    const html = await render({}, locale);
    expect(html).toContain(tr("providerLocations.heading"));
    expect(html).toContain(tr("providerLocations.addressHint"));
    expect(html).toMatch(/<optgroup label="[^"]+"><option value="city-skopje">/);
    expect(html).toContain(locale === "sq" ? ">skopje</option>" : locale === "en" ? ">Skopje</option>" : locale === "mk" ? ">Скопје</option>" : ">Скопие</option>");
    if (locale === "sq") expect(html).not.toMatch(/Skopje|Скопје/);
    expect(html).not.toMatch(/synthetic-private|localhost:8080/);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toMatchObject({ title: tr("providerLocations.heading"), robots: { index: false, follow: false } });
  });
}
test("lists addresses with city and country, and marks unlisted cities", async () => {
  const html = await render();
  expect(html).toContain("Skopje, North Macedonia");
  expect(html).toContain(`${t("providerLocations.retired")}, North Macedonia`);
});
test("editing keeps a retired city selected instead of replacing it", async () => {
  const html = await render({ edit: "loc-2" });
  expect(html).toContain(`<option value="city-retired" selected="">${t("providerLocations.retired")}</option>`);
  expect(html).toContain('name="version" value="0"');
});
test("removal warns that linked services lose the location", async () => {
  const html = await render({ remove: "loc-1" });
  expect(html).toContain(t("providerLocations.removeHeading"));
  expect(html).toContain(t("providerLocations.removeNote"));
});
test("an empty list shows the empty state", async () => {
  vi.mocked(listLocations).mockResolvedValue({ state: "ready", records: [] });
  expect(await render()).toContain(t("providerLocations.empty"));
});
test.each<[string, () => void]>([
  ["countries", () => vi.mocked(listCountries).mockResolvedValue({ state: "unavailable" })],
  ["cities", () => vi.mocked(listCities).mockResolvedValue({ state: "unavailable" })],
  ["locations", () => vi.mocked(listLocations).mockResolvedValue({ state: "forbidden" })],
])("failed %s hide every editor with a safe notice", async (_name, fail) => {
  fail();
  const html = await render();
  expect(html).toMatch(new RegExp(`${t("account.unavailable")}|${t("account.forbidden")}`));
  expect(html).not.toMatch(/<form|<select/);
});
