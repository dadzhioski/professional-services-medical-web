import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { t } from "../../../src/lib/i18n/en";
const require = createRequire(resolve("package.json"));
function fixture(up: boolean) {
  execFileSync(process.execPath, ["scripts/integration.mjs", up ? "fixture-up" : "fixture-down"], { stdio: "pipe" });
}
test.afterEach(() => fixture(true));
for (const up of [true, false]) {
  test(`Caddy SSR without JavaScript (${up ? "up" : "unavailable"})`, async ({ browser, baseURL }) => {
    fixture(up);
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      const response = await page.goto("/system-status");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: t("systemStatus.heading") })).toBeVisible();
      await expect(page.getByText(up ? "synthetic-api" : t("systemStatus.unavailable"))).toBeVisible();
    } finally { await context.close(); }
  });
  test(`Caddy accessibility and responsive layout (${up ? "up" : "unavailable"})`, async ({ page }) => {
    fixture(up);
    await page.goto("/system-status");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations);
    expect(violations).toEqual([]);
  });
}
test("Caddy carries a photo upload without JavaScript and serves the owner image", async ({ browser, baseURL }) => {
  fixture(true);
  // A synthetic session accepted by the integration fixture.
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  await context.addCookies([{ name: "platform-session-local", value: "synthetic-session-browser", url: baseURL! }]);
  try {
    const page = await context.newPage();
    await page.goto("/en/provider/profile");
    await page.getByLabel(t("media.file")).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
    await page.locator("#photo").getByRole("button", { name: new RegExp(`^(${t("photo.upload")}|${t("photo.replace")})$`) }).click();
    await expect(page.getByText(t("photo.saved"))).toBeVisible();
    const src = await page.getByRole("img", { name: t("photo.current") }).getAttribute("src");
    expect(src).toMatch(/^\/api\/v1\/media\/[0-9a-f-]{36}\/content$/);
    const image = await context.request.get(src!);
    expect(image.status()).toBe(200);
    expect(image.headers()["cache-control"]).toBe("no-store");
  } finally { await context.close(); }
});
