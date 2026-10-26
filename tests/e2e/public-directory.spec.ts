import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const t = translator("en");

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function edge(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/v1/public/media/`), async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: fixture + url.pathname, maxRedirects: 0 }) });
  });
}
const control = (request: APIRequestContext, path: string) => request.post(`${fixture}/control/${path}`);
const seed = async (request: APIRequestContext, query = "") =>
  (await (await control(request, `public/seed${query && `?${query}`}`)).json()) as { slug: string; photoMediaId: string };
async function withoutJavaScript(browser: Browser, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await edge(context);
  try { await run(await context.newPage()); } finally { await context.close(); }
}
const names = (page: Page) => page.getByRole("main").getByRole("article").getByRole("heading", { level: 2 }).allTextContents();
const photosLoaded = (page: Page) => page.locator("main article img").evaluateAll(images =>
  images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));

test.beforeEach(async ({ request, context }) => {
  await control(request, "identity/reset");
  await edge(context);
});
test.afterEach(async ({ request }) => { await control(request, "identity/reset"); });

for (const locale of localeCodes) {
  test(`${locale}: the header leads to the directory and a profile without JavaScript`, async ({ browser, request }) => {
    const tl = translator(locale);
    const { slug } = await seed(request);
    await withoutJavaScript(browser, async page => {
      await page.goto(`${origin}/${locale}`);
      await page.getByRole("banner").getByRole("link", { name: tl("navigation.directory"), exact: true }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/doctors`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("banner").getByRole("link", { name: tl("navigation.directory"), exact: true }))
        .toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(tl("directory.heading"));
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/${locale}/doctors`);
      await page.getByRole("link", { name: "Dr. Synthetic Public" }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/doctors/${slug}`);
      await page.getByRole("link", { name: tl("publicProfile.backToDirectory") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/doctors`);
    });
  });
}

test("the entry page links to the directory and bare /doctors redirects to the default locale", async ({ page }) => {
  await page.goto(`${origin}/en`);
  await page.getByRole("main").getByRole("link", { name: t("home.directoryAction") }).click();
  await expect(page).toHaveURL(`${origin}/en/doctors`);
  await page.goto(`${origin}/doctors`);
  await expect(page).toHaveURL(`${origin}/mk/doctors`);
});

test("specialty and city filters work alone and combined without JavaScript", async ({ browser, request }) => {
  await seed(request, "name=Dr.%20Alpha&specialty=cardiology&city=skopje");
  await seed(request, "name=Dr.%20Beta&specialty=dermatology&city=sofia");
  await seed(request, "name=Dr.%20Gamma&specialty=cardiology&city=sofia");
  await withoutJavaScript(browser, async page => {
    await page.goto(`${origin}/en/doctors`);
    expect(await names(page)).toEqual(["Dr. Alpha", "Dr. Beta", "Dr. Gamma"]);
    await expect(page.getByText(`${t("directory.count")}: 3`)).toBeVisible();
    expect(await photosLoaded(page)).toBe(true);
    await page.getByLabel(t("directory.specialty")).selectOption({ label: "Cardiology" });
    await page.getByRole("button", { name: t("directory.apply") }).click();
    expect(await names(page)).toEqual(["Dr. Alpha", "Dr. Gamma"]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/en/doctors`);
    await page.getByLabel(t("directory.city")).selectOption({ label: "Sofia" });
    await page.getByRole("button", { name: t("directory.apply") }).click();
    expect(await names(page)).toEqual(["Dr. Gamma"]);
    await expect(page.getByLabel(t("directory.specialty"))).toHaveValue(/.+/);
    await page.getByLabel(t("directory.specialty")).selectOption({ label: "Dermatology" });
    await page.getByLabel(t("directory.city")).selectOption({ label: "Skopje" });
    await page.getByRole("button", { name: t("directory.apply") }).click();
    await expect(page.getByText(t("directory.noMatch"))).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: t("directory.reset") }).first().click();
    await expect(page).toHaveURL(`${origin}/en/doctors`);
    expect(await names(page)).toHaveLength(3);
  });
});

test("pagination, out-of-range and invalid pages render safe states without JavaScript", async ({ browser, request }) => {
  for (let index = 0; index < 21; index++) await seed(request, `name=Dr.%20Page%20${String(index).padStart(2, "0")}`);
  await withoutJavaScript(browser, async page => {
    await page.goto(`${origin}/en/doctors`);
    expect(await names(page)).toHaveLength(20);
    const pages = page.getByRole("navigation", { name: t("directory.pagination") });
    await expect(pages.locator('[aria-current="page"]')).toHaveText(`${t("directory.page")} 1 ${t("directory.of")} 2`);
    await expect(pages.locator('a[rel="prev"]')).toHaveCount(0);
    await pages.getByRole("link", { name: t("directory.next") }).click();
    await expect(page).toHaveURL(`${origin}/en/doctors?page=2`);
    expect(await names(page)).toEqual(["Dr. Page 20"]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(pages.locator('a[rel="prev"]')).toHaveAttribute("href", "/en/doctors");

    await page.goto(`${origin}/en/doctors?page=9`);
    await expect(page.getByText(t("directory.beyondEnd"))).toBeVisible();
    await page.getByRole("link", { name: t("directory.lastPage") }).click();
    await expect(page).toHaveURL(`${origin}/en/doctors?page=2`);

    for (const query of ["page=0", "page=abc", "specialty=not-a-reference", "city=5b0c1d2e-0000-4000-8000-000000000999"]) {
      const response = await page.goto(`${origin}/en/doctors?${query}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByText(t("directory.invalid"))).toBeVisible();
      expect(await page.content()).not.toMatch(/synthetic-private-error|Problem/);
    }
  });
});

test("keyboard, 320 px and axe checks on the directory", async ({ page, request }) => {
  await seed(request);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${origin}/en/doctors`);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
  await page.getByLabel(t("directory.specialty")).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(t("directory.city"))).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t("directory.apply") })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
});

for (const revocation of ["unpublish", "suspend"]) {
  test(`${revocation} removes the doctor and photo from the next directory request`, async ({ page, request }) => {
    const { photoMediaId } = await seed(request);
    await page.goto(`${origin}/en/doctors`);
    expect(await photosLoaded(page)).toBe(true);
    await control(request, `public/${revocation}`);
    await page.goto(`${origin}/en/doctors`);
    await expect(page.getByText(t("directory.empty"))).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("Dr. Synthetic Public");
    expect(html).not.toContain(photoMediaId);
    expect((await page.goto(`${origin}/api/v1/public/media/${photoMediaId}/content`))?.status()).toBe(404);
  });
}

test("an unavailable API is a non-indexed alert and the HTML holds no private values", async ({ page, request }) => {
  await seed(request);
  await page.goto(`${origin}/en/doctors`);
  const html = await page.content();
  expect(html).toContain("Dr. Synthetic Public");
  expect(html).not.toMatch(privateValues);
  expect(html).not.toMatch(/Synthetic public biography|Synthetic street|Synthetic licence|Synthetic consultation/);
  await control(request, "identity/down");
  const response = await page.goto(`${origin}/en/doctors`);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(t("directory.unavailable"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(await page.content()).not.toMatch(/Dr\. Synthetic Public|synthetic-private-error/);
});

test("a visitor session cookie is never forwarded to the directory API", async ({ context, page, request }) => {
  await seed(request);
  await context.addCookies([{ name: "platform-session-local", value: "synthetic-session-visitor", url: origin }]);
  // The fixture rejects a forwarded cookie with 400, which would replace the results with the invalid state.
  await page.goto(`${origin}/en/doctors`);
  await expect(page.getByRole("link", { name: "Dr. Synthetic Public" })).toBeVisible();
});
