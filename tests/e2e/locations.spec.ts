import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const skopje = "0a6b1c2d-0000-4000-8000-000000000001";
const sofia = "0a6b1c2d-0000-4000-8000-000000000003";
const cardiology = "5b0c1d2e-0000-4000-8000-000000000001";
const t = translator("en");

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(`${origin}/api/auth/login?*`, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
async function openWorkspace(page: Page, locale: Locale = "en") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: tr("account.login") }).click();
  await expect(page.getByText(tr("account.authenticated"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
}
const mode = (request: APIRequestContext, value: string) => request.post(`${fixture}/control/identity/${value}`);
const item = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
const summaryOf = (page: Page) => page.getByRole("region", { name: t("records.problem") });
const addRegion = (page: Page) => page.getByRole("region", { name: t("providerLocations.add") });
async function fillLocation(page: Page, label: string, country = "MK", city = skopje) {
  const form = addRegion(page);
  await form.getByLabel(t("providerLocations.label")).fill(label);
  await form.getByLabel(t("providerLocations.address")).fill("1 Synthetic Street");
  await form.getByLabel(t("providerLocations.country")).selectOption(country);
  await form.getByLabel(t("providerLocations.city")).selectOption(city);
}

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

test("a city from another country is flagged and the input is kept", async ({ page }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/locations");
  await expect(page.getByText(t("providerLocations.empty"))).toBeVisible();
  await fillLocation(page, "Synthetic Clinic", "MK", sofia);
  await addRegion(page).getByRole("button", { name: t("providerLocations.create") }).click();
  await expect(summaryOf(page)).toBeFocused();
  await expect(summaryOf(page)).toContainText(t("records.error.mismatch"));
  await expect(addRegion(page).getByLabel(t("providerLocations.label"))).toHaveValue("Synthetic Clinic");
  await expect(addRegion(page).getByLabel(t("providerLocations.country"))).toHaveValue("MK");
  await expect(addRegion(page).getByLabel(t("providerLocations.city"))).toHaveValue(sofia);
  await addRegion(page).getByLabel(t("providerLocations.city")).selectOption(skopje);
  await addRegion(page).getByRole("button", { name: t("providerLocations.create") }).click();
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await expect(item(page, "Synthetic Clinic")).toContainText("Skopje, North Macedonia");
});

test("an unknown city reference is rejected by the API without claiming success", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    await openWorkspace(page);
    await page.goto("/en/provider/locations");
    const fields = await addRegion(page).locator("form input[type=hidden]").evaluateAll(inputs =>
      Object.fromEntries(inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
    const response = await context.request.post(`${origin}/en/provider/locations`, { headers: { Origin: origin }, multipart: {
      ...fields, label: "Forged", displayAddress: "1 Synthetic Street", countryCode: "MK", cityId: "0a6b1c2d-0000-4000-8000-0000000000ff" } });
    const html = await response.text();
    expect(html).toContain(t("records.rejected"));
    expect(html).not.toContain(t("records.saved"));
    await page.reload();
    await expect(page.getByText(t("providerLocations.empty"))).toBeVisible();
  } finally { await context.close(); }
});

test("removing a location also unlinks it from services, after confirmation", async ({ page }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/locations");
  await fillLocation(page, "Synthetic Clinic");
  await addRegion(page).getByRole("button", { name: t("providerLocations.create") }).click();
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await page.goto("/en/provider/services");
  const form = page.getByRole("region", { name: t("providerServices.add") });
  await form.getByLabel(t("providerServices.name")).fill("Linked service");
  await form.getByLabel("Synthetic Clinic, 1 Synthetic Street").check();
  await form.getByRole("button", { name: t("providerServices.create") }).click();
  await expect(item(page, "Linked service")).toContainText("Synthetic Clinic");
  await page.goto("/en/provider/locations");
  await item(page, "Synthetic Clinic").getByRole("link", { name: new RegExp(t("records.remove")) }).click();
  const confirm = page.getByRole("region", { name: t("providerLocations.removeHeading") });
  await expect(confirm).toContainText(t("providerLocations.removeNote"));
  await confirm.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(page.getByText(t("records.removed"))).toBeVisible();
  await page.goto("/en/provider/services");
  await expect(item(page, "Linked service")).toContainText(t("records.empty"));
});

test("a stale location edit offers the latest version", async ({ page, request }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/locations");
  await fillLocation(page, "Synthetic Clinic");
  await addRegion(page).getByRole("button", { name: t("providerLocations.create") }).click();
  await item(page, "Synthetic Clinic").getByRole("link", { name: new RegExp(t("records.edit")) }).click();
  await request.post(`${fixture}/control/catalog/bump`);
  const editor = page.getByRole("region", { name: t("providerLocations.editHeading") });
  await editor.getByLabel(t("providerLocations.label")).fill("Mine");
  await editor.getByRole("button", { name: t("providerLocations.save") }).click();
  await expect(summaryOf(page)).toContainText(t("records.conflict"));
  await expect(page.getByRole("region", { name: t("records.latestHeading") })).toContainText("Edited elsewhere");
  await page.getByRole("link", { name: t("records.discard") }).click();
  await expect(page.getByRole("region", { name: t("providerLocations.editHeading") }).getByLabel(t("providerLocations.label")))
    .toHaveValue("Edited elsewhere");
});

test("the locations editor is responsive and passes axe", async ({ page }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/locations");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe("specialty on the profile page", () => {
  test("is chosen by stable ID, kept across reloads and shown as the code in Albanian", async ({ page }) => {
    await openWorkspace(page);
    await page.goto("/en/provider/profile");
    const select = page.getByLabel(t("specialtyEditor.label"), { exact: true });
    await expect(select).toHaveValue("");
    await select.selectOption({ label: "Cardiology" });
    await page.getByRole("button", { name: t("specialtyEditor.save") }).click();
    await expect(page.getByText(t("specialtyEditor.saved"))).toBeVisible();
    // The saved choice stays selected without a reload, so saving again cannot restore the old value.
    await expect(select).toHaveValue(cardiology);
    await page.reload();
    await expect(select).toHaveValue(cardiology);
    await page.goto("/sq/provider/profile");
    await expect(page.getByLabel(translator("sq")("specialtyEditor.label"), { exact: true }).locator("option:checked")).toHaveText("cardiology");
  });
  test("an unknown specialty is rejected and unavailable reference data hides the choice", async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    try {
      const page = await context.newPage();
      await openWorkspace(page);
      await page.goto("/en/provider/profile");
      const fields = await page.getByRole("region", { name: t("specialtyEditor.heading") }).locator("form input[type=hidden]")
        .evaluateAll(inputs => Object.fromEntries(inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
      const response = await context.request.post(`${origin}/en/provider/profile`, { headers: { Origin: origin },
        multipart: { ...fields, specialtyId: "5b0c1d2e-0000-4000-8000-0000000000ff" } });
      const html = await response.text();
      expect(html).toContain(t("records.rejected"));
      // The saved message is part of the serialized client messages, so assert on the empty live region instead.
      expect(html).toContain('<div role="status"></div>');
      await mode(request, "catalog-down");
      await page.reload();
      await expect(page.getByLabel(t("specialtyEditor.label"), { exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  });
});
