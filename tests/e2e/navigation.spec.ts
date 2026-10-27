import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(`${origin}/api/auth/login?*`, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
async function withoutJavaScript(browser: import("@playwright/test").Browser, run: (page: Page, context: BrowserContext) => Promise<void>) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try { await run(await context.newPage(), context); } finally { await context.close(); }
}
async function signIn(page: Page, locale: Locale = "en") {
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: translator(locale)("account.login") }).click();
  await expect(page.getByText(translator(locale)("account.authenticated"))).toBeVisible();
}
const mode = (request: { post: (url: string) => Promise<unknown> }, value: string) => request.post(`${fixture}/control/identity/${value}`);

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of ["mk", "en"] as const) {
  test(`${locale}: signed-out visitor reaches sign-in from the header and the entry page without JavaScript`, async ({ browser }) => {
    const t = translator(locale);
    await withoutJavaScript(browser, async page => {
      await page.goto(`${origin}/${locale}`);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: t("app.title") })).toHaveAttribute("aria-current", "page");
      await expect(header.getByRole("navigation", { name: t("navigation.primary") })).toBeVisible();
      await expect(header.getByRole("button")).toHaveCount(0);
      await header.getByRole("link", { name: t("navigation.doctors") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
      await expect(page.getByRole("main").getByRole("link", { name: t("account.login") })).toBeVisible();
      await page.goto(`${origin}/${locale}`);
      await page.getByRole("main").getByRole("link", { name: t("home.doctorsAction") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
      await expect(page.getByRole("main").getByRole("link", { name: t("account.login") })).toBeVisible();
    });
  });
}

test("signed-in header on every localized page, and header sign-out without JavaScript", async ({ browser }) => {
  await withoutJavaScript(browser, async (page, context) => {
    await signIn(page, "en");
    for (const [path, locale] of [["/mk", "mk"], ["/en", "en"], ["/en/provider/onboarding", "en"], ["/en/provider", "en"]] as const) {
      const t = translator(locale);
      const response = await page.goto(`${origin}${path}`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      expect(await response!.text()).not.toMatch(privateValues);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: t("navigation.workspace") })).toHaveAttribute("href", `/${locale}/provider`);
      await expect(header.getByRole("button", { name: t("account.logout") })).toBeVisible();
    }
    const t = translator("en");
    await page.goto(`${origin}/en`);
    await page.getByRole("banner").getByRole("button", { name: t("account.logout") }).click();
    await expect(page.getByRole("main").getByText(t("account.signedOut"))).toBeVisible();
    expect((await context.cookies()).filter(cookie => cookie.name === "platform-session-local")).toEqual([]);
    await page.goto(`${origin}/en`);
    await expect(page.getByRole("banner").getByRole("link", { name: t("navigation.doctors") })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
  });
});

test("identity failures render the signed-out header with the page intact", async ({ page, request }) => {
  const t = translator("en");
  await signIn(page, "en");
  for (const failure of ["down", "expired", "forbidden"]) {
    await mode(request, failure);
    const response = await page.goto("/en");
    expect(response!.status()).toBe(200);
    expect(await response!.text()).not.toContain("synthetic-private-error");
    await expect(page.getByRole("heading", { level: 1, name: t("home.heading") })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: t("navigation.doctors") })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
  }
});

for (const locale of ["mk", "en"] as const) {
  test(`${locale}: entry page keyboard, 320 px and axe checks`, async ({ page }) => {
    const t = translator(locale);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/${locale}`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const link of await page.getByRole("banner").getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  });
}
