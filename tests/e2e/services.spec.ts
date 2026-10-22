import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const skopje = "0a6b1c2d-0000-4000-8000-000000000001";
const t = translator("en");

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(`${origin}/api/auth/login?*`, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
// Signs in and creates the workspace that every record API requires.
async function openWorkspace(page: Page, locale: Locale = "en") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: tr("account.login") }).click();
  await expect(page.getByText(tr("account.authenticated"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
}
async function addLocation(page: Page, locale: Locale = "en", label = "Synthetic Clinic") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/provider/locations`);
  const form = page.getByRole("region", { name: tr("providerLocations.add") });
  await form.getByLabel(tr("providerLocations.label")).fill(label);
  await form.getByLabel(tr("providerLocations.address")).fill("1 Synthetic Street");
  await form.getByLabel(tr("providerLocations.country")).selectOption("MK");
  await form.getByLabel(tr("providerLocations.city")).selectOption(skopje);
  await form.getByRole("button", { name: tr("providerLocations.create") }).click();
  await expect(page.getByText(tr("records.saved"))).toBeVisible();
}
async function addService(page: Page, name: string, price?: string, locale: Locale = "en") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/provider/services`);
  const form = page.getByRole("region", { name: tr("providerServices.add") });
  await form.getByLabel(tr("providerServices.name")).fill(name);
  if (price !== undefined) {
    await form.getByLabel(tr("providerServices.priceSet"), { exact: true }).check();
    await form.getByLabel(tr("providerServices.amount")).fill(price);
    await form.getByLabel(tr("providerServices.currency")).selectOption("MKD");
  }
  await form.getByRole("button", { name: tr("providerServices.create") }).click();
  await expect(page.getByText(tr("records.saved"))).toBeVisible();
}
const mode = (request: APIRequestContext, value: string) => request.post(`${fixture}/control/identity/${value}`);
const item = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
const summaryOf = (page: Page) => page.getByRole("region", { name: t("records.problem") });
// Hidden inputs carry the server action reference; everything else is supplied by the test.
const actionFields = (page: Page, region: string) => page.getByRole("region", { name: region }).locator("form input[type=hidden]")
  .evaluateAll(inputs => Object.fromEntries(inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of localeCodes) {
  test(`${locale}: add, edit and remove a service with a location and a free price without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tr = translator(locale);
    try {
      await openWorkspace(page, locale);
      await addLocation(page, locale);
      await page.goto(`${origin}/${locale}/provider/services`);
      await expect(page.getByText(tr("providerServices.empty"))).toBeVisible();
      const form = page.getByRole("region", { name: tr("providerServices.add") });
      await form.getByLabel(tr("providerServices.name")).fill("Synthetic consultation");
      await form.getByLabel(tr("providerServices.priceSet"), { exact: true }).check();
      await form.getByLabel(tr("providerServices.amount")).fill("0");
      await form.getByLabel(tr("providerServices.currency")).selectOption("MKD");
      await form.getByLabel("Synthetic Clinic, 1 Synthetic Street").check();
      await form.getByRole("button", { name: tr("providerServices.create") }).click();
      await expect(page.getByText(tr("records.saved"))).toBeVisible();
      const listed = item(page, "Synthetic consultation");
      await expect(listed).toContainText(/0[.,]00/);
      await expect(listed).toContainText("Synthetic Clinic, 1 Synthetic Street");
      // Editing to "no price" removes the price instead of storing zero.
      await listed.getByRole("link", { name: new RegExp(tr("records.edit")) }).click();
      const editor = page.getByRole("region", { name: tr("providerServices.editHeading") });
      await expect(editor.getByLabel(tr("providerServices.amount"))).toHaveValue("0.00");
      await editor.getByLabel(tr("providerServices.priceNone"), { exact: true }).check();
      await editor.getByRole("button", { name: tr("providerServices.save") }).click();
      await expect(item(page, "Synthetic consultation")).toContainText(tr("providerServices.priceNotPublished"));
      const response = await page.goto(`${origin}/${locale}/provider/services`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      expect(await response!.text()).not.toMatch(privateValues);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await item(page, "Synthetic consultation").getByRole("link", { name: new RegExp(tr("records.remove")) }).click();
      const confirm = page.getByRole("region", { name: tr("providerServices.removeHeading") });
      await confirm.getByRole("link", { name: tr("records.cancel") }).click();
      await expect(item(page, "Synthetic consultation")).toBeVisible();
      await item(page, "Synthetic consultation").getByRole("link", { name: new RegExp(tr("records.remove")) }).click();
      await page.getByRole("button", { name: tr("records.removeConfirm") }).click();
      await expect(page.getByText(tr("records.removed"))).toBeVisible();
      await expect(page.getByText(tr("providerServices.empty"))).toBeVisible();
    } finally { await context.close(); }
  });
}

test("invalid amounts are kept and keyboard users reach the field from the summary", async ({ page, request }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/services");
  const form = page.getByRole("region", { name: t("providerServices.add") });
  await form.getByLabel(t("providerServices.name")).fill("Synthetic consultation");
  await form.getByLabel(t("providerServices.priceSet"), { exact: true }).check();
  await form.getByLabel(t("providerServices.amount")).fill("12.345");
  await form.getByLabel(t("providerServices.currency")).selectOption("EUR");
  await form.getByLabel(t("providerServices.amount")).press("Enter");
  await expect(summaryOf(page)).toBeFocused();
  await expect(summaryOf(page)).toContainText(t("records.invalid"));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(form.getByLabel(t("providerServices.amount"))).toBeFocused();
  await expect(form.getByLabel(t("providerServices.amount"))).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByLabel(t("providerServices.name"))).toHaveValue("Synthetic consultation");
  // Selects and radios keep the submitted choice after a failed submission, not their first-render default.
  await expect(form.getByLabel(t("providerServices.currency"))).toHaveValue("EUR");
  await expect(form.getByLabel(t("providerServices.priceSet"), { exact: true })).toBeChecked();
  await mode(request, "catalog-reject");
  await form.getByLabel(t("providerServices.amount")).fill("12.34");
  await form.getByRole("button", { name: t("providerServices.create") }).click();
  await expect(summaryOf(page)).toContainText(t("records.rejected"));
  await expect(form.getByLabel(t("providerServices.amount"))).toHaveValue("12.34");
  await expect(form.getByLabel(t("providerServices.currency"))).toHaveValue("EUR");
  await expect(page.getByText(t("records.saved"))).toHaveCount(0);
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
});

test("a stale service edit is reviewed and never silently overwritten", async ({ page, request }) => {
  await openWorkspace(page);
  await addService(page, "Synthetic consultation");
  await item(page, "Synthetic consultation").getByRole("link", { name: new RegExp(t("records.edit")) }).click();
  const editor = page.getByRole("region", { name: t("providerServices.editHeading") });
  await request.post(`${fixture}/control/catalog/bump`);
  await editor.getByLabel(t("providerServices.name")).fill("Mine");
  await editor.getByRole("button", { name: t("providerServices.save") }).click();
  await expect(summaryOf(page)).toContainText(t("records.conflict"));
  await expect(page.getByRole("region", { name: t("records.latestHeading") })).toContainText("Edited elsewhere");
  await expect(editor.getByLabel(t("providerServices.name"))).toHaveValue("Mine");
  await page.getByRole("button", { name: t("records.overwrite") }).click();
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await expect(item(page, "Mine")).toBeVisible();
});

test("a location owned by another organization cannot be linked", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    await openWorkspace(page);
    await page.goto("/en/provider/services");
    const { locationId } = await (await request.post(`${fixture}/control/catalog/foreign`)).json() as { locationId: string };
    const fields = await actionFields(page, t("providerServices.add"));
    const response = await context.request.post(`${origin}/en/provider/services`, { headers: { Origin: origin },
      multipart: { ...fields, name: "Forged link", priceMode: "none", locationIds: locationId } });
    const html = await response.text();
    expect(html).toContain(t("records.rejected"));
    expect(html).not.toContain(t("records.saved"));
    expect(html).not.toMatch(/Foreign clinic|Foreign street/);
    await page.reload();
    await expect(page.getByText(t("providerServices.empty"))).toBeVisible();
    // The same submission without the site Origin is refused before reaching the API.
    const crossSite = await context.request.post(`${origin}/en/provider/services`, { multipart: { ...fields, name: "Cross-site", priceMode: "none" } });
    expect(await crossSite.text()).toContain(`${t("account.forbidden")} ${t("records.keptInput")}`);
  } finally { await context.close(); }
});

test("a failed deletion is reported and the service stays listed", async ({ page, request }) => {
  await openWorkspace(page);
  await addService(page, "Synthetic consultation", "120.50");
  await expect(item(page, "Synthetic consultation")).toContainText(/120[.,]50/);
  await item(page, "Synthetic consultation").getByRole("link", { name: new RegExp(t("records.remove")) }).click();
  await mode(request, "delete-fail");
  await page.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(page.getByRole("alert").filter({ hasText: t("account.unavailable") })).toBeVisible();
  await expect(page.getByText(t("records.removed"))).toHaveCount(0);
  await expect(item(page, "Synthetic consultation")).toBeVisible();
});

test("an API-reported unpublication after removal is shown", async ({ page, request }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/profile");
  await page.getByRole("button", { name: t("profileEditor.create") }).click();
  await expect(page.getByLabel(t("profileEditor.displayName"))).toBeVisible();
  await addService(page, "Only service");
  await request.post(`${fixture}/control/profile/publish`);
  await page.reload();
  await expect(page.getByText(t("profileEditor.publication.published"))).toBeVisible();
  await item(page, "Only service").getByRole("link", { name: new RegExp(t("records.remove")) }).click();
  await page.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(page.getByText(t("records.removed"))).toBeVisible();
  await expect(page.getByText(t("profileEditor.publication.unpublished"))).toBeVisible();
});

test("unavailable records hide the editors; anonymous visitors see sign-in only", async ({ page, request, playwright }) => {
  await openWorkspace(page);
  await mode(request, "catalog-down");
  await page.goto("/en/provider/services");
  await expect(page.getByRole("alert").filter({ hasText: t("account.unavailable") })).toBeVisible();
  await expect(page.locator("main form")).toHaveCount(0);
  await mode(request, "up");
  await addService(page, "Private service name");
  const anonymous = await playwright.request.newContext();
  try {
    const html = await (await anonymous.get(`${origin}/en/provider/services`)).text();
    expect(html).toContain(t("account.signedOut"));
    expect(html).not.toContain("Private service name");
  } finally { await anonymous.dispose(); }
});

test("the services editor is keyboard accessible, responsive and passes axe, including errors", async ({ page }) => {
  await openWorkspace(page);
  await addLocation(page);
  await addService(page, "Synthetic consultation", "0");
  const axe = async () => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  };
  await page.goto("/en/provider/services");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe();
  const form = page.getByRole("region", { name: t("providerServices.add") });
  await form.getByLabel(t("providerServices.name")).fill("Second");
  await form.getByLabel(t("providerServices.priceSet"), { exact: true }).check();
  await form.getByLabel(t("providerServices.amount")).fill("abc");
  await form.getByRole("button", { name: t("providerServices.create") }).click();
  await expect(summaryOf(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe();
  await item(page, "Synthetic consultation").getByRole("link", { name: new RegExp(t("records.remove")) }).click();
  await axe();
});
