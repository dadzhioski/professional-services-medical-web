import { render } from "@testing-library/react";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// The header owns the language links; the page only supplies the path they keep.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ path }: { path: string }) => <header data-language-path={path} /> }));
// Spoofed request authority must never influence canonical output.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "http" }),
  cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic-visitor-session" }] }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/lib/api/public-directory", () => ({ readPublicDirectory: vi.fn() }));
vi.mock("@/lib/api/reference", () => ({ listSpecialties: vi.fn(), listCities: vi.fn(), listCountries: vi.fn() }));
import type { PublicDoctorPage, PublicDoctorSummary } from "@dadzhioski/professional-services-api-client";
import type { SearchParams } from "@/features/public-directory/query";
import { readPublicDirectory } from "@/lib/api/public-directory";
import { listCities, listCountries, listSpecialties } from "@/lib/api/reference";
import { localeCodes, translator, type Locale } from "@/lib/i18n";
import Page, { dynamic, generateMetadata } from "./page";

const labels = (code: string) => ({ mk: `mk-${code}`, en: `en-${code}`, bg: `bg-${code}` });
const specialties = [{ id: "spec-1", code: "cardiology", labels: labels("cardiology") }, { id: "spec-2", code: "dermatology", labels: labels("dermatology") }];
const cities = [{ id: "city-1", code: "skopje", countryCode: "MK", labels: labels("skopje") },
  { id: "city-2", code: "sofia", countryCode: "BG", labels: labels("sofia") }];
const countries = [{ code: "MK", labels: labels("MK") }, { code: "BG", labels: labels("BG") }];
const photoMediaId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const doctor: PublicDoctorSummary = { slug: "dr-synthetic", displayName: "Synthetic Doctor", photoMediaId,
  specialty: specialties[0], cities: [cities[0], cities[0], cities[1]] };
const pageOf = (content: PublicDoctorSummary[], page = 0, totalElements = content.length, totalPages = Math.ceil(totalElements / 20)):
  PublicDoctorPage => ({ content, page, size: 20, totalElements, totalPages });

const props = (locale = "en", search: SearchParams = {}) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(search) });
const html$ = async (locale = "en", search: SearchParams = {}) => renderToStaticMarkup(await Page(props(locale, search)));
const documentOf = (html: string) => new DOMParser().parseFromString(html, "text/html");
const ready = (page: PublicDoctorPage = pageOf([doctor])) => vi.mocked(readPublicDirectory).mockResolvedValue({ state: "ready", page });
const label = (locale: Locale, code: string) => locale === "sq" ? code : `${locale}-${code}`;
// Language links also point to /en/doctors; reset links are found by their text.
const resets = (page: Document) => [...page.querySelectorAll('main a[href="/en/doctors"]')]
  .filter(link => link.textContent === translator("en")("directory.reset"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSpecialties).mockResolvedValue({ state: "ready", records: specialties });
  vi.mocked(listCities).mockResolvedValue({ state: "ready", records: cities });
  vi.mocked(listCountries).mockResolvedValue({ state: "ready", records: countries });
});
test("the page is rendered per request", () => expect(dynamic).toBe("force-dynamic"));

for (const locale of localeCodes) {
  test(`${locale} renders filters, results and indexable metadata in the initial HTML`, async () => {
    const t = translator(locale);
    ready();
    const page = documentOf(await html$(locale));
    expect(readPublicDirectory).toHaveBeenCalledWith(undefined, undefined, 0);
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    expect(page.querySelector("h1")?.textContent).toBe(t("directory.heading"));
    const form = page.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe(`/${locale}/doctors`);
    expect(page.querySelector('label[for="directory-specialty"]')?.textContent).toBe(t("directory.specialty"));
    expect(page.querySelector('label[for="directory-city"]')?.textContent).toBe(t("directory.city"));
    expect([...page.querySelectorAll("#directory-specialty option")].map(option => option.textContent))
      .toEqual([t("directory.anySpecialty"), label(locale, "cardiology"), label(locale, "dermatology")]);
    expect([...page.querySelectorAll("#directory-city optgroup")].map(group => group.getAttribute("label")))
      .toEqual([label(locale, "MK"), label(locale, "BG")]);
    expect(form.querySelector('button[type="submit"]')?.textContent).toBe(t("directory.apply"));
    expect(page.body.textContent).toContain(`${t("directory.count")}: 1`);
    const result = page.querySelector("main ul li article")!;
    expect(result.querySelector(`h2 a[href="/${locale}/doctors/dr-synthetic"]`)?.textContent).toBe("Synthetic Doctor");
    expect(result.textContent).toContain(label(locale, "cardiology"));
    expect(result.textContent).toContain(`${label(locale, "skopje")}, ${label(locale, "sofia")}`);
    const image = result.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(`/api/v1/public/media/${photoMediaId}/content`);
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("width")).toBe("64");
    expect(page.querySelector("nav[aria-label] a[rel]")).toBeNull();
    expect(page.querySelector("header")?.getAttribute("data-language-path")).toBe(`/${locale}/doctors`);

    const url = `http://localhost:3000/${locale}/doctors`;
    const title = t("directory.title");
    const description = t("directory.description");
    expect(await generateMetadata(props(locale))).toEqual({
      title, description,
      alternates: { canonical: url, languages: Object.fromEntries([...localeCodes.map(code =>
        [code, `http://localhost:3000/${code}/doctors`]), ["x-default", "http://localhost:3000/mk/doctors"]]) },
      openGraph: { type: "website", url, title, description, locale, siteName: t("app.title") },
      robots: { index: true, follow: true },
    });
  });
}

test("valid filters stay selected, are sent to the API and pages are 1-based", async () => {
  ready(pageOf(Array(20).fill(doctor).map((item, index) => ({ ...item, slug: `dr-${index}` })), 1, 45));
  const page = documentOf(await html$("en", { specialty: "spec-2", city: "city-2", page: "2", utm_source: "ignored" }));
  expect(readPublicDirectory).toHaveBeenCalledWith("spec-2", "city-2", 1);
  expect(page.querySelector<HTMLOptionElement>('#directory-specialty option[value="spec-2"]')?.selected).toBe(true);
  expect(page.querySelector<HTMLOptionElement>('#directory-city option[value="city-2"]')?.selected).toBe(true);
  const t = translator("en");
  const nav = page.querySelector(`nav[aria-label="${t("directory.pagination")}"]`)!;
  expect(nav.querySelector('a[rel="prev"]')?.getAttribute("href")).toBe("/en/doctors?specialty=spec-2&city=city-2");
  expect(nav.querySelector('a[rel="next"]')?.getAttribute("href")).toBe("/en/doctors?specialty=spec-2&city=city-2&page=3");
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(`${t("directory.page")} 2 ${t("directory.of")} 3`);
  expect(resets(page)).toHaveLength(1);
  expect((await generateMetadata(props("en", { specialty: "spec-2" }))).robots).toEqual({ index: false, follow: true });
  expect((await generateMetadata(props("en", { page: "2" }))).robots).toEqual({ index: false, follow: true });
  expect((await generateMetadata(props("en", { page: "2" }))).alternates?.canonical).toBe("http://localhost:3000/en/doctors");
});

test.each([
  { specialty: "spec-9" }, { city: "not-a-city" }, { specialty: ["spec-1", "spec-2"] }, { page: "0" }, { page: "abc" }, { page: "-1" },
])("invalid input renders a translated reset state without calling the API %#", async search => {
  const t = translator("en");
  const page = documentOf(await html$("en", search));
  expect(readPublicDirectory).not.toHaveBeenCalled();
  expect(page.body.textContent).toContain(t("directory.invalid"));
  expect(resets(page)).toHaveLength(1);
  expect((await generateMetadata(props("en", search))).robots).toEqual({ index: false, follow: true });
});

test("an API rejection of the request renders the same invalid state", async () => {
  vi.mocked(readPublicDirectory).mockResolvedValue({ state: "invalid" });
  const html = await html$("en", { specialty: "spec-1" });
  expect(html).toContain(translator("en")("directory.invalid"));
  expect(html).not.toContain('role="alert"');
});

test("empty, no-match and beyond-the-end states are distinct", async () => {
  const t = translator("en");
  ready(pageOf([]));
  expect(await html$()).toContain(t("directory.empty"));
  const noMatch = documentOf(await html$("en", { city: "city-1" }));
  expect(noMatch.body.textContent).toContain(t("directory.noMatch"));
  expect(resets(noMatch)).toHaveLength(2);
  ready(pageOf([], 4, 45, 3));
  const beyond = documentOf(await html$("en", { city: "city-1", page: "5" }));
  expect(beyond.body.textContent).toContain(t("directory.beyondEnd"));
  expect(beyond.querySelector('a[href="/en/doctors?city=city-1&page=3"]')?.textContent).toBe(t("directory.lastPage"));
});

test("unavailable reference lists still list doctors without filters", async () => {
  vi.mocked(listCities).mockResolvedValue({ state: "unavailable" });
  vi.mocked(listCountries).mockResolvedValue({ state: "unavailable" });
  ready();
  const html = await html$();
  expect(html).not.toContain("<form");
  expect(html).toContain(translator("en")("directory.referencesUnavailable"));
  expect(html).toContain("Synthetic Doctor");
  expect((await generateMetadata(props())).robots).toEqual({ index: true, follow: true });
});

test("countries are optional; city groups fall back to the country code", async () => {
  vi.mocked(listCountries).mockResolvedValue({ state: "unavailable" });
  ready();
  expect([...documentOf(await html$()).querySelectorAll("optgroup")].map(group => group.getAttribute("label"))).toEqual(["MK", "BG"]);
});

test("an unavailable directory renders a translated, non-indexed alert without raw errors", async () => {
  vi.mocked(readPublicDirectory).mockResolvedValue({ state: "unavailable" });
  for (const locale of localeCodes) {
    const t = translator(locale);
    const html = await html$(locale);
    expect(html).toContain(`role="alert"`);
    expect(html).toContain(t("directory.unavailable"));
    expect(html).not.toMatch(/localhost:8080|evil\.test/);
    expect(await generateMetadata(props(locale))).toEqual({ title: t("directory.unavailableTitle"), robots: { index: false, follow: false } });
  }
});

test("malicious supplied text stays inert", async () => {
  const hostile = '</script><script>alert("x")</script><img src=x onerror="alert(1)">';
  ready(pageOf([{ ...doctor, displayName: hostile, slug: 'a"b/<c>', photoMediaId: "javascript:alert(1)",
    specialty: { id: "spec-1", code: "x", labels: { en: hostile } } }]));
  const html = await html$();
  expect(html).not.toMatch(/<script|<img src=x|javascript:/);
  expect(html).toContain('href="/en/doctors/a%22b%2F%3Cc%3E"');
});

test("unsupported locales are not found", async () => {
  await expect(Page(props("fr"))).rejects.toThrow("not-found");
  await expect(generateMetadata(props("fr"))).rejects.toThrow("not-found");
});

test.each(["ready", "paged", "empty", "invalid", "unavailable"] as const)("the %s state passes accessibility checks", async state => {
  if (state === "ready") ready();
  else if (state === "paged") ready(pageOf([doctor], 1, 45));
  else if (state === "empty") ready(pageOf([]));
  else vi.mocked(readPublicDirectory).mockResolvedValue({ state: "unavailable" });
  render(await Page(props("en", state === "invalid" ? { page: "x" } : state === "paged" ? { page: "2" } : {})));
  expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
});
