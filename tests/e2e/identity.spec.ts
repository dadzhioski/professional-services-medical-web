import { test, expect, type BrowserContext } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(`${origin}/api/auth/login?*`, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
test.beforeEach(async ({ request, context }) => {
  await request.post(`${fixture}/control/identity/reset`);
  await navigation(context);
});
test.afterEach(async ({ request }) => { await request.post(`${fixture}/control/identity/reset`); });

for (const locale of localeCodes) {
  test(`${locale}: synthetic login, private SSR and logout without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const t = translator(locale);
    try {
      await page.goto(`${origin}/${locale}/provider`);
      await expect(page.getByText(t("account.signedOut"))).toBeVisible();
      await page.getByRole("link", { name: t("account.login") }).click();
      await expect(page.getByText(t("account.authenticated"))).toBeVisible();
      const response = await page.reload();
      expect(response!.headers()["cache-control"]).toContain("no-store");
      const html = await response!.text();
      expect(html).toContain(t("account.authenticated"));
      expect(html).not.toMatch(/synthetic-session|synthetic-csrf|synthetic-private-account|127\.0\.0\.1:4311/);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await page.getByRole("main").getByRole("button", { name: t("account.logout") }).click();
      await expect(page.getByText(t("account.signedOut"))).toBeVisible();
      expect((await context.cookies()).filter(cookie => cookie.name === "platform-session-local")).toEqual([]);
    } finally { await context.close(); }
  });
}

test("expiry, forbidden, outage and CSRF rejection stay safe", async ({ page, request }) => {
  const t = translator("en");
  await page.goto("/en/provider");
  await page.getByRole("link", { name: t("account.login") }).click();
  for (const [mode, key] of [["expired", "expired"], ["forbidden", "forbidden"], ["down", "unavailable"], ["up", "authenticated"]] as const) {
    await request.post(`${fixture}/control/identity/${mode}`);
    const response = await page.reload();
    await expect(page.getByText(t(`account.${key}`))).toBeVisible();
    expect(await response!.text()).not.toContain("synthetic-private-error");
  }
  await request.post(`${fixture}/control/identity/bad-csrf`);
  await page.getByRole("main").getByRole("button", { name: t("account.logout") }).click();
  await expect(page.getByText(t("account.forbidden"))).toBeVisible();
  await request.post(`${fixture}/control/identity/up`);
  await page.getByRole("main").getByRole("button", { name: t("account.logout") }).click();
  await expect(page.getByText(t("account.signedOut"))).toBeVisible();
});

test("independent browser sessions and accessible responsive shell", async ({ page, browser }) => {
  const t = translator("en");
  await page.goto("/en/provider");
  await page.getByRole("link", { name: t("account.login") }).click();
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(`${origin}/en/provider`);
    await expect(otherPage.getByText(t("account.signedOut"))).toBeVisible();
    await expect(page.getByText(t("account.authenticated"))).toBeVisible();
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  } finally { await other.close(); }
});

test("web logout rejects missing Origin without invalidating the session", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    const t = translator("en");
    await page.goto(`${origin}/en/provider`);
    await page.getByRole("link", { name: t("account.login") }).click();
    const fields = await page.locator("main form input").evaluateAll(inputs => Object.fromEntries(
      inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
    const response = await context.request.post(`${origin}/en/provider`, { multipart: fields, maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe("/en/provider?notice=forbidden");
    await page.reload();
    await expect(page.getByText(t("account.authenticated"))).toBeVisible();
  } finally { await context.close(); }
});
