import { render } from "@testing-library/react";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
// Spoofed request authority must never influence canonical output.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "http" }),
  cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic-visitor-session" }] }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/lib/api/public-profile", () => ({ readPublicProfile: vi.fn() }));
import type { PublicProfileResponse } from "@dadzhioski/professional-services-api-client";
import { readPublicProfile } from "@/lib/api/public-profile";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { dynamic, generateMetadata } from "./page";

const photoMediaId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const reference = (code: string) => ({ id: `ref-${code}`, code, labels: { mk: `mk-${code}`, en: `en-${code}`, bg: `bg-${code}` } });
const published: PublicProfileResponse = {
  slug: "dr-synthetic", displayName: "Synthetic Doctor", biography: "Synthetic biography\nsecond line", photoMediaId,
  specialty: reference("cardiology"),
  credentials: [{ type: "LICENSE", title: "Synthetic licence", issuer: "Synthetic board", issuedOn: new Date(2020, 0, 15), expiresOn: null }],
  services: [{ name: "Synthetic consultation", description: "Synthetic description", price: { amount: "25.00", currency: "EUR" } },
    { name: "Synthetic follow-up", description: null }],
  locations: [{ label: "Synthetic clinic", displayAddress: "Synthetic street 1", countryCode: "MK", city: reference("skopje") }],
};
const params = (locale = "en", slug = "dr-synthetic") => ({ params: Promise.resolve({ locale, slug }) });
const render$ = async (locale = "en") => renderToStaticMarkup(await Page(params(locale)));
const ready = (profile: PublicProfileResponse = published) => vi.mocked(readPublicProfile).mockResolvedValue({ state: "ready", profile });
const jsonLd = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);

beforeEach(() => vi.clearAllMocks());
test("the page is rendered per request", () => expect(dynamic).toBe("force-dynamic"));

for (const locale of localeCodes) {
  test(`${locale} renders the published profile, photo and structured data in the initial HTML`, async () => {
    const t = translator(locale);
    ready();
    const html = await render$(locale);
    expect(readPublicProfile).toHaveBeenCalledWith("dr-synthetic");
    expect(html).toContain("<h1");
    expect(html).toContain("Synthetic Doctor");
    for (const key of ["profile.introduction", "profile.specialties", "profile.credentials", "profile.services", "profile.locations"] as const) {
      expect(html).toContain(t(key));
    }
    expect(html).toContain(locale === "sq" ? "cardiology" : `${locale}-cardiology`);
    expect(html).toContain(`${t("credential.type.license")}: Synthetic licence`);
    expect(html).toContain(t("credentials.noExpiry"));
    expect(html).toContain("Synthetic street 1");
    expect(html).toContain(`src="/api/v1/public/media/${photoMediaId}/content"`);
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain(`href="/${locale === "mk" ? "en" : "mk"}/doctors/dr-synthetic"`);
    expect(html).toContain(`href="/${locale}/doctors">${t("publicProfile.backToDirectory")}</a>`);
    const data = jsonLd(html);
    expect(data).toMatchObject({ "@type": "Physician", name: "Synthetic Doctor", url: `http://localhost:3000/${locale}/doctors/dr-synthetic` });
    expect(JSON.stringify(data)).not.toMatch(/media|image|rating|evil/);

    const title = `Synthetic Doctor – ${locale === "sq" ? "cardiology" : `${locale}-cardiology`}`;
    const url = `http://localhost:3000/${locale}/doctors/dr-synthetic`;
    const description = "Synthetic biography second line";
    expect(await generateMetadata(params(locale))).toEqual({
      title, description,
      alternates: { canonical: url, languages: Object.fromEntries([...localeCodes.map(code =>
        [code, `http://localhost:3000/${code}/doctors/dr-synthetic`]), ["x-default", "http://localhost:3000/mk/doctors/dr-synthetic"]]) },
      openGraph: { type: "profile", url, title, description, locale, siteName: t("app.title") },
      twitter: { card: "summary", title, description },
      robots: { index: true, follow: true },
    });
  });
}
test("optional data can be absent without empty sections, photo or structured groups", async () => {
  ready({ slug: "dr-synthetic", displayName: "Synthetic Doctor", photoMediaId: null });
  const html = await render$();
  const t = translator("en");
  expect(html).not.toContain("<img");
  expect(html).not.toContain(t("profile.credentials"));
  expect(html).not.toContain(t("profile.introduction"));
  expect(Object.keys(jsonLd(html))).toEqual(["@context", "@type", "name", "url", "description"]);
  expect((await generateMetadata(params())).description).toBe(`Synthetic Doctor. ${t("publicProfile.descriptionFallback")}`);
});
test("malicious supplied text stays inert in HTML, metadata and structured data", async () => {
  const hostile = '</script><script>alert("x")</script><!--';
  ready({ ...published, displayName: hostile, biography: hostile,
    services: [{ name: hostile, description: '<img src=x onerror="alert(1)">' }], photoMediaId: "javascript:alert(1)" });
  const html = await render$();
  expect(html).not.toContain("<script>alert");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("javascript:");
  expect(html.match(/<script/g)).toHaveLength(1);
  expect(jsonLd(html).name).toBe(hostile);
  expect((await generateMetadata(params())).title).toBe(`${hostile} – en-cardiology`);
});
test("missing profiles and unsupported locales are not found", async () => {
  vi.mocked(readPublicProfile).mockResolvedValue({ state: "missing" });
  await expect(Page(params())).rejects.toThrow("not-found");
  await expect(generateMetadata(params())).rejects.toThrow("not-found");
  await expect(Page(params("fr"))).rejects.toThrow("not-found");
  await expect(generateMetadata(params("fr"))).rejects.toThrow("not-found");
});
test("an unavailable API renders a translated, non-indexed failure without profile content", async () => {
  vi.mocked(readPublicProfile).mockResolvedValue({ state: "unavailable" });
  for (const locale of localeCodes) {
    const t = translator(locale);
    const html = await render$(locale);
    expect(html).toContain(`role="alert"`);
    expect(html).toContain(t("publicProfile.unavailable"));
    expect(html).toContain(`href="/${locale}/doctors"`);
    expect(html).not.toContain("application/ld+json");
    expect(await generateMetadata(params(locale))).toEqual({ title: t("publicProfile.unavailableTitle"), robots: { index: false, follow: false } });
  }
});
test.each(["ready", "unavailable"] as const)("the %s state passes accessibility checks", async state => {
  if (state === "ready") ready(); else vi.mocked(readPublicProfile).mockResolvedValue({ state });
  render(await Page(params()));
  expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
});
