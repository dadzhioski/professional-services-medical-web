import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { t } from "../../src/lib/i18n/en";
const require = createRequire(resolve("package.json"));
const fixture = "http://127.0.0.1:4311";

test.beforeEach(async ({ request }) => { await request.post(`${fixture}/control/up`); });
test.afterEach(async ({ request }) => { await request.post(`${fixture}/control/up`); });

test("status SSR, outage, health and recovery without browser JavaScript", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const available of [true, false, true]) {
      await request.post(`${fixture}/control/${available ? "up" : "down"}`);
      const response = await page.goto("http://127.0.0.1:4310/system-status");
      expect(response?.status()).toBe(200);
      const html = await response!.text();
      expect(html).toContain(available ? "synthetic-api" : t("systemStatus.unavailable"));
      expect(html).not.toMatch(/synthetic-private-error|127\.0\.0\.1:4311|API_INTERNAL_URL|ResponseError/);
      if (available) {
        await expect(page.locator("dd")).toHaveText(["synthetic-api", "0.2.0", t("systemStatus.up")]);
      } else {
        await expect(page.getByText(t("systemStatus.unavailable"))).toBeVisible();
        await expect(page.locator("dl")).toHaveCount(0);
      }
      const health = await request.get("/healthz");
      expect(health.status()).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });
      expect(health.headers()["cache-control"]).toBe("no-store");
    }
  } finally { await context.close(); }
});

for (const available of [true, false]) {
  test(`accessible responsive status (${available ? "up" : "unavailable"})`, async ({ page, request }) => {
    await request.post(`${fixture}/control/${available ? "up" : "down"}`);
    const apiRequests: string[] = [];
    page.on("request", (req) => { if (req.url().includes("/api/")) apiRequests.push(req.url()); });
    await page.goto("/system-status");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations);
    expect(violations).toEqual([]);
    expect(apiRequests).toEqual([]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
}
