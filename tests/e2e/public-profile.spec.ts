import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function edge(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/v1/public/media/`), async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: fixture + url.pathname, maxRedirects: 0 }) });
  });
}
const control = (request: APIRequestContext, path: string) => request.post(`${fixture}/control/${path}`);
let seeded: { slug: string; photoMediaId: string };
const photoPath = () => `/api/v1/public/media/${seeded.photoMediaId}/content`;
const jsonLd = async (page: Page) => JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "null");
const photoLoaded = (page: Page) => page.locator("main img").evaluate(image => (image as HTMLImageElement).complete &&
  (image as HTMLImageElement).naturalWidth > 0);

test.beforeEach(async ({ request, context }) => {
  await control(request, "identity/reset");
  seeded = await (await control(request, "public/seed")).json();
  await edge(context);
});

for (const locale of localeCodes) {
  test(`${locale}: an anonymous visitor reads the published profile without JavaScript`, async ({ browser }) => {
    const t = translator(locale);
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await edge(context);
      const page = await context.newPage();
      const response = await page.goto(`${origin}/${locale}/doctors/${seeded.slug}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toContain("no-store");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dr. Synthetic Public");
      await expect(page.getByText('Synthetic public biography <script>alert("x")</script>')).toBeVisible();
      for (const key of ["profile.specialties", "profile.credentials", "profile.services", "profile.locations"] as const) {
        await expect(page.getByRole("heading", { level: 2, name: t(key) })).toBeVisible();
      }
      await expect(page.getByText(`${t("credential.type.license")}: Synthetic licence`)).toBeVisible();
      await expect(page.getByText("Synthetic street 1")).toBeVisible();
      expect(await photoLoaded(page)).toBe(true);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/${locale}/doctors/${seeded.slug}`);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${origin}/mk/doctors/${seeded.slug}`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${origin}/${locale}/doctors/${seeded.slug}`);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
      expect(await jsonLd(page)).toMatchObject({ "@type": "Physician", name: "Dr. Synthetic Public",
        url: `${origin}/${locale}/doctors/${seeded.slug}` });
      const html = await page.content();
      expect(html).not.toMatch(privateValues);
      expect(html).not.toContain("<script>alert");
    } finally { await context.close(); }
  });
}

test("keyboard, 320 px and axe checks on the public profile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${origin}/en/doctors/${seeded.slug}`);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: translator("en")("navigation.skipToContent") })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
});

for (const revocation of ["unpublish", "suspend"]) {
  test(`${revocation} removes the profile and its photo on the next request after earlier reads`, async ({ page, request }) => {
    await page.goto(`${origin}/en/doctors/${seeded.slug}`);
    expect(await photoLoaded(page)).toBe(true);
    expect((await page.goto(origin + photoPath()))?.status()).toBe(200);
    await control(request, `public/${revocation}`);
    const response = await page.goto(`${origin}/en/doctors/${seeded.slug}`);
    expect(response?.status()).toBe(404);
    const html = await page.content();
    expect(html).not.toContain("Dr. Synthetic Public");
    expect(html).not.toContain(seeded.photoMediaId);
    expect((await page.goto(origin + photoPath()))?.status()).toBe(404);
  });
}

test("unknown profiles are not found and an unavailable API is not indexed", async ({ page, request }) => {
  expect((await page.goto(`${origin}/en/doctors/dr-unknown`))?.status()).toBe(404);
  await control(request, "identity/down");
  const response = await page.goto(`${origin}/en/doctors/${seeded.slug}`);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(translator("en")("publicProfile.unavailable"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  expect(await page.content()).not.toMatch(/Dr\. Synthetic Public|synthetic-private-error/);
});

test("spoofed Host and forwarded headers never change canonical or structured URLs", async ({ request }) => {
  const response = await request.get(`${origin}/en/doctors/${seeded.slug}`, { headers: {
    "X-Forwarded-Host": "evil.test", "X-Forwarded-Proto": "https", Forwarded: "host=evil.test;proto=https" } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain(`<link rel="canonical" href="${origin}/en/doctors/${seeded.slug}"/>`);
  expect(html).not.toContain("evil.test");
});

test("a visitor session cookie is never forwarded to the public profile API", async ({ context, page }) => {
  await context.addCookies([{ name: "platform-session-local", value: "synthetic-session-visitor", url: origin }]);
  // The fixture rejects a forwarded cookie, which would surface as the unavailable state.
  expect((await page.goto(`${origin}/en/doctors/${seeded.slug}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dr. Synthetic Public");
});
