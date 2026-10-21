import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator, type Locale } from "../../src/lib/i18n";

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

for (const locale of localeCodes) {
  test(`${locale}: first onboarding and resume without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const t = translator(locale);
    try {
      await signIn(page, locale);
      await expect(page.getByText(t("workspace.missing"))).toBeVisible();
      await page.getByRole("link", { name: t("workspace.start") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
      await expect(page.getByText(t("onboarding.todo"))).toBeVisible();
      await page.getByRole("button", { name: t("onboarding.create") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/provider`);
      await expect(page.getByText(t("workspace.ready"))).toBeVisible();
      await expect(page.getByText(t("workspace.approval.pending"))).toBeVisible();
      const response = await page.goto(`${origin}/${locale}/provider/onboarding`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      await expect(page.getByText(t("onboarding.done"))).toBeVisible();
      await expect(page.getByRole("button", { name: t("onboarding.create") })).toHaveCount(0);
      expect(await response!.text()).not.toMatch(privateValues);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    } finally { await context.close(); }
  });
}

test("repeated submission is prevented and retries reuse the same workspace", async ({ page }) => {
  const t = translator("en");
  await signIn(page);
  await page.goto("/en/provider/onboarding");
  const button = page.getByRole("button", { name: t("onboarding.create") });
  await button.dblclick();
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByText(t("onboarding.done"))).toBeVisible();
});

test("ambiguous failure recovers from current context; failure never looks successful", async ({ page, request }) => {
  const t = translator("en");
  await signIn(page);
  await page.goto("/en/provider/onboarding");
  await mode(request, "onboard-down");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.unavailable"))).toBeVisible();
  await expect(page.getByText(t("workspace.ready"))).toHaveCount(0);
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
  await mode(request, "onboard-lost");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page).toHaveURL(`${origin}/en/provider`);
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
});

test("existing membership resumes in a new session; other accounts stay isolated", async ({ page, browser, request }) => {
  const t = translator("en");
  await mode(request, "same-account");
  await signIn(page);
  await page.goto("/en/provider/onboarding");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
  const returning = await browser.newContext();
  await navigation(returning);
  try {
    const returningPage = await returning.newPage();
    await signIn(returningPage);
    await expect(returningPage.getByText(t("workspace.ready"))).toBeVisible();
  } finally { await returning.close(); }
  await mode(request, "reset");
  const other = await browser.newContext();
  await navigation(other);
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage);
    await expect(otherPage.getByText(t("workspace.missing"))).toBeVisible();
  } finally { await other.close(); }
});

test("expired, unverified, forbidden and unavailable states stay safe", async ({ page, request }) => {
  const t = translator("en");
  await signIn(page);
  for (const [value, key] of [["expired", "expired"], ["unverified", "forbidden"], ["down", "unavailable"], ["context-down", "unavailable"]] as const) {
    await mode(request, value);
    const response = await page.goto("/en/provider/onboarding");
    await expect(page.getByText(t(`account.${key}`))).toBeVisible();
    await expect(page.getByRole("button", { name: t("onboarding.create") })).toHaveCount(0);
    expect(await response!.text()).not.toMatch(/synthetic-private-error/);
  }
  await mode(request, "up");
  await page.goto("/en/provider/onboarding");
  await mode(request, "expired");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.expired"))).toBeVisible();
  await mode(request, "bad-csrf");
  await page.goto("/en/provider/onboarding");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.forbidden"))).toBeVisible();
  await expect(page.getByText(t("onboarding.todo"))).toBeVisible();
});

test("API restriction is presented without inventing permissions", async ({ page, request }) => {
  const t = translator("en");
  await signIn(page);
  await page.goto("/en/provider/onboarding");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await mode(request, "suspended");
  await page.reload();
  await expect(page.getByText(t("workspace.suspended"))).toBeVisible();
});

test("submissions ignore foreign identifiers and require the site Origin", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    const t = translator("en");
    await signIn(page);
    await page.goto(`${origin}/en/provider/onboarding`);
    const fields = await page.locator("form input").evaluateAll(inputs => Object.fromEntries(
      inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
    const crossSite = await context.request.post(`${origin}/en/provider/onboarding`, { multipart: fields, maxRedirects: 0 });
    expect(crossSite.headers().location).toBe("/en/provider/onboarding?notice=forbidden");
    await page.reload();
    await expect(page.getByText(t("onboarding.todo"))).toBeVisible();
    const forged = await context.request.post(`${origin}/en/provider/onboarding`, { maxRedirects: 0, headers: { Origin: origin },
      multipart: { ...fields, organizationId: "foreign-org", role: "ADMIN" } });
    expect(forged.headers().location).toBe("/en/provider");
    await page.goto(`${origin}/en/provider`);
    await expect(page.getByText(t("workspace.ready"))).toBeVisible();
    expect(await page.content()).not.toMatch(/foreign-org|ADMIN/);
  } finally { await context.close(); }
});

test("onboarding is keyboard accessible, responsive and passes axe", async ({ page }) => {
  await signIn(page);
  for (const path of ["/en/provider/onboarding", "/en/provider"]) {
    await page.goto(path);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: translator("en")("navigation.skipToContent") })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  }
});
