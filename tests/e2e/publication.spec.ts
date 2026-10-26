import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const t = translator("en");

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/auth/login\\?`), async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
const control = (request: APIRequestContext, path: string) => request.post(`${fixture}/control/${path}`);
const mode = (request: APIRequestContext, value: string) => control(request, `identity/${value}`);

async function signIn(page: Page, locale: Locale = "en") {
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: translator(locale)("account.login") }).click();
  await expect(page.getByText(translator(locale)("account.authenticated"))).toBeVisible();
}
// A doctor whose profile has every owner-provided part except an approved credential.
async function doctor(page: Page, request: APIRequestContext, locale: Locale = "en") {
  const tr = translator(locale);
  await signIn(page, locale);
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/profile`);
  await page.getByRole("button", { name: tr("profileEditor.create") }).click();
  await expect(page.getByRole("heading", { name: tr("photo.heading") })).toBeVisible();
  await control(request, "profile/complete");
}
// Approval comes only from an administrator decision in a separate session.
async function approve(browser: Browser, request: APIRequestContext) {
  const context = await browser.newContext();
  await navigation(context);
  try {
    const page = await context.newPage();
    await signIn(page);
    await control(request, "admin/grant");
    await page.goto(`${origin}/en/admin/doctors`);
    await page.getByRole("link", { name: new RegExp(`^${t("review.open")}`) }).click();
    await page.getByRole("link", { name: t("review.action.approve"), exact: true }).click();
    await page.locator("section[aria-labelledby=decision]").getByRole("button", { name: t("review.action.approve") }).click();
    await expect(page.getByText(t("review.outcome.approved"))).toBeVisible();
  } finally { await context.close(); }
}
const openPublication = (page: Page, locale: Locale = "en") => page.goto(`${origin}/${locale}/provider/publication`);
async function confirm(page: Page, action: "publish" | "unpublish", locale: Locale = "en") {
  const tr = translator(locale);
  await page.getByRole("link", { name: tr(`publication.${action}`) }).click();
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: tr(`publication.${action}`) }).click();
}

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

test("an unapproved or incomplete profile cannot be published and names what is missing", async ({ page, request }) => {
  await doctor(page, request);
  await openPublication(page);
  await expect(page.getByText(t("publication.needsApproval"))).toBeVisible();
  await expect(page.getByRole("link", { name: t("publication.missing.credential") })).toHaveAttribute("href", "/en/provider/credentials");
  await expect(page.getByRole("link", { name: t("publication.publish") })).toHaveCount(0);
  // A forged confirmation step is not rendered for an ineligible profile.
  await page.goto(`${origin}/en/provider/publication?confirm=publish`);
  await expect(page.getByRole("button", { name: t("publication.publish") })).toHaveCount(0);
});

for (const locale of localeCodes) {
  test(`${locale} eligible publication and explicit unpublishing work without JavaScript`, async ({ browser, request }) => {
    const tr = translator(locale);
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    try {
      const page = await context.newPage();
      await doctor(page, request, locale);
      await control(request, "credentials/seed");
      await approve(browser, request);
      await openPublication(page, locale);
      await expect(page.getByText(tr("publication.complete"))).toBeVisible();
      await confirm(page, "publish", locale);
      await expect(page.getByText(tr("publication.outcome.published"))).toBeVisible();
      await expect(page.getByText(tr("profileEditor.publication.published"), { exact: true })).toBeVisible();
      await confirm(page, "unpublish", locale);
      await expect(page.getByText(tr("publication.outcome.unpublished"))).toBeVisible();
      await expect(page.getByText(tr("publication.republishNote"))).toBeVisible();
      expect(await page.content()).not.toMatch(privateValues);
    } finally { await context.close(); }
  });
}

test("completeness loss after an edit unpublishes and needs an explicit republish", async ({ page, browser, request }) => {
  await doctor(page, request);
  await control(request, "credentials/seed");
  await approve(browser, request);
  await openPublication(page);
  await confirm(page, "publish");
  await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();
  await page.goto(`${origin}/en/provider/locations`);
  await page.getByRole("link", { name: new RegExp(`^${t("records.remove")}`) }).first().click();
  await page.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(page.getByText(t("records.removed"))).toBeVisible();
  await openPublication(page);
  await expect(page.getByText(t("profileEditor.publication.unpublished"), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: t("publication.missing.location") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("publication.publish") })).toHaveCount(0);
});

test("a publication the API refuses or that went stale is never shown as published", async ({ page, browser, request }) => {
  await doctor(page, request);
  await control(request, "credentials/seed");
  await approve(browser, request);
  await openPublication(page);
  await page.getByRole("link", { name: t("publication.publish") }).click();
  await control(request, "profile/bump");
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: t("publication.publish") }).click();
  await expect(page.getByText(t("publication.outcome.conflict"))).toBeVisible();
  await expect(page.getByText(t("profileEditor.publication.draft"), { exact: true })).toBeVisible();

  // The page offered publication, but the profile became incomplete before confirming.
  await page.getByRole("link", { name: t("publication.publish") }).click();
  const other = await page.context().newPage();
  await other.goto(`${origin}/en/provider/services`);
  await other.getByRole("link", { name: new RegExp(`^${t("records.remove")}`) }).first().click();
  await other.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(other.getByText(t("records.removed"))).toBeVisible();
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: t("publication.publish") }).click();
  await expect(page.getByText(t("publication.outcome.incomplete"))).toBeVisible();
  await expect(page.getByRole("link", { name: t("publication.missing.service") })).toBeVisible();
});

test("the publication page is responsive, never indexed and passes axe", async ({ page, browser, request }) => {
  await doctor(page, request);
  await control(request, "credentials/seed");
  await approve(browser, request);
  await openPublication(page);
  await page.getByRole("link", { name: t("publication.publish") }).click();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
});
