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
// Each price-list row is a fieldset named by its position.
const entry = (page: Page, number: number, locale: Locale = "en") =>
  page.getByRole("group", { name: `${translator(locale)("providerServices.entry")} ${number}`, exact: true });
async function fillEntry(page: Page, number: number, name: string, amount = "", currency?: string, locale: Locale = "en") {
  const tr = translator(locale);
  const row = entry(page, number, locale);
  await row.getByLabel(tr("providerServices.name")).fill(name);
  await row.getByLabel(tr("providerServices.amount")).fill(amount);
  if (currency) await row.getByLabel(tr("providerServices.currency")).selectOption(currency);
}
async function saveList(page: Page, locale: Locale = "en") {
  await page.getByRole("button", { name: translator(locale)("providerServices.save") }).click();
}
async function addService(page: Page, name: string, price?: string) {
  await page.goto(`${origin}/en/provider/services`);
  await fillEntry(page, 1, name, price ?? "");
  await saveList(page);
  await expect(page.getByText(t("records.saved"))).toBeVisible();
}
const mode = (request: APIRequestContext, value: string) => request.post(`${fixture}/control/identity/${value}`);
const summaryOf = (page: Page) => page.getByRole("region", { name: t("records.problem") });
// Hidden inputs carry the server action reference and row identity; everything else is supplied by the test.
const actionFields = (page: Page) => page.locator("main form input[type=hidden]")
  .evaluateAll(inputs => Object.fromEntries(inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of localeCodes) {
  test(`${locale}: enter, edit and remove several price-list entries with one save each, without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tr = translator(locale);
    try {
      await openWorkspace(page, locale);
      await addLocation(page, locale);
      await page.goto(`${origin}/${locale}/provider/services`);
      // The empty list suggests the examination price first.
      await expect(entry(page, 1, locale).getByLabel(tr("providerServices.name"))).toHaveValue(tr("providerServices.suggestedFirst"));
      await fillEntry(page, 1, tr("providerServices.suggestedFirst"), "1500", undefined, locale);
      await fillEntry(page, 2, "Synthetic ultrasound", "120,50", "EUR", locale);
      await fillEntry(page, 3, "Synthetic free check", "0", undefined, locale);
      await saveList(page, locale);
      await expect(page.getByText(tr("records.saved"))).toBeVisible();
      await expect(entry(page, 1, locale).getByLabel(tr("providerServices.amount"))).toHaveValue("1500.00");
      await expect(entry(page, 2, locale).getByLabel(tr("providerServices.amount"))).toHaveValue("120.50");
      await expect(entry(page, 2, locale).getByLabel(tr("providerServices.currency"))).toHaveValue("EUR");
      await expect(entry(page, 3, locale).getByLabel(tr("providerServices.amount"))).toHaveValue("0.00");

      // One save changes a price, clears another and removes an entry.
      await entry(page, 1, locale).getByLabel(tr("providerServices.amount")).fill("1600");
      await entry(page, 3, locale).getByLabel(tr("providerServices.amount")).fill("");
      await entry(page, 2, locale).getByLabel(tr("providerServices.remove")).check();
      await saveList(page, locale);
      await expect(page.getByText(tr("records.saved"))).toBeVisible();
      await expect(entry(page, 1, locale).getByLabel(tr("providerServices.amount"))).toHaveValue("1600.00");
      await expect(entry(page, 2, locale).getByLabel(tr("providerServices.name"))).toHaveValue("Synthetic free check");
      await expect(entry(page, 2, locale).getByLabel(tr("providerServices.amount"))).toHaveValue("");
      await expect(entry(page, 3, locale).getByLabel(tr("providerServices.name"))).toHaveValue("");

      // More rows without losing unsaved input.
      await fillEntry(page, 3, "Unsaved", "10", undefined, locale);
      await page.getByRole("button", { name: tr("providerServices.more") }).click();
      await expect(entry(page, 3, locale).getByLabel(tr("providerServices.name"))).toHaveValue("Unsaved");
      await expect(entry(page, 13, locale)).toBeVisible();

      const response = await page.goto(`${origin}/${locale}/provider/services`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      expect(await response!.text()).not.toMatch(privateValues);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(entry(page, 3, locale).getByLabel(tr("providerServices.name"))).toHaveValue("");
    } finally { await context.close(); }
  });
}

test("pasted lines become reviewable rows and are saved only with the list", async ({ page }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/services");
  await fillEntry(page, 1, "First examination", "1200");
  await page.getByLabel(t("providerServices.pasteLabel")).fill("1. Abdominal ultrasound – 1.500 den\n• ECG: 25,50 EUR\n\nHolter 24 hours");
  await page.getByRole("button", { name: t("providerServices.pasteAdd") }).click();
  await expect(page.getByRole("status").filter({ hasText: t("providerServices.imported") })).toBeVisible();
  await expect(entry(page, 1).getByLabel(t("providerServices.amount"))).toHaveValue("1200");
  await expect(entry(page, 2).getByLabel(t("providerServices.name"))).toHaveValue("Abdominal ultrasound");
  await expect(entry(page, 2).getByLabel(t("providerServices.amount"))).toHaveValue("1500");
  await expect(entry(page, 3).getByLabel(t("providerServices.currency"))).toHaveValue("EUR");
  await expect(entry(page, 4).getByLabel(t("providerServices.name"))).toHaveValue("Holter 24 hours");
  await expect(entry(page, 4).getByLabel(t("providerServices.amount"))).toHaveValue("");
  await expect(page.getByLabel(t("providerServices.pasteLabel"))).toHaveValue("");
  // Nothing was saved yet.
  await page.reload();
  await expect(entry(page, 2).getByLabel(t("providerServices.name"))).toHaveValue("");
  await page.getByLabel(t("providerServices.pasteLabel")).fill("A 10\nB 20");
  await page.getByRole("button", { name: t("providerServices.pasteAdd") }).click();
  // The untouched suggestion is not carried into the imported list.
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("A");
  await expect(entry(page, 2).getByLabel(t("providerServices.name"))).toHaveValue("B");
  await saveList(page);
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("A");
  await expect(entry(page, 2).getByLabel(t("providerServices.name"))).toHaveValue("B");
  await page.getByLabel(t("providerServices.pasteLabel")).fill(" \n ");
  await page.getByRole("button", { name: t("providerServices.pasteAdd") }).click();
  await expect(page.getByRole("status").filter({ hasText: t("providerServices.importedNone") })).toBeVisible();
});

test("invalid amounts are kept and keyboard users reach the field from the summary", async ({ page, request }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/services");
  await fillEntry(page, 1, "Synthetic consultation", "12.345", "EUR");
  await entry(page, 1).getByLabel(t("providerServices.amount")).press("Enter");
  await expect(summaryOf(page)).toBeFocused();
  await expect(summaryOf(page)).toContainText(t("records.invalid"));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const amount = entry(page, 1).getByLabel(t("providerServices.amount"));
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("Synthetic consultation");
  // Selects keep the submitted choice after a failed submission, not their first-render default.
  await expect(entry(page, 1).getByLabel(t("providerServices.currency"))).toHaveValue("EUR");
  await mode(request, "catalog-reject");
  await amount.fill("12.34");
  await saveList(page);
  await expect(summaryOf(page)).toContainText(t("providerServices.partial"));
  await expect(entry(page, 1)).toContainText(t("providerServices.rowRejected"));
  await expect(amount).toHaveValue("12.34");
  await expect(page.getByText(t("records.saved"))).toHaveCount(0);
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
});

test("an entry changed elsewhere is shown and replaced only by saving again", async ({ page, request }) => {
  await openWorkspace(page);
  await addService(page, "Synthetic consultation", "100");
  await request.post(`${fixture}/control/catalog/bump`);
  await entry(page, 1).getByLabel(t("providerServices.name")).fill("Mine");
  await saveList(page);
  await expect(summaryOf(page)).toContainText(t("providerServices.partial"));
  await expect(entry(page, 1)).toContainText(t("providerServices.rowConflict"));
  await expect(entry(page, 1)).toContainText("Edited elsewhere");
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("Mine");
  await saveList(page);
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("Mine");
});

test("forged identifiers are never sent and cross-site submissions are refused", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    await openWorkspace(page);
    await page.goto("/en/provider/services");
    const fields = await actionFields(page);
    // An identifier the list does not contain is reported as removed elsewhere, not updated.
    const response = await context.request.post(`${origin}/en/provider/services`, { headers: { Origin: origin },
      multipart: { ...fields, rows: "1", "serviceId-0": "6d0f1f4e-2b4c-4a51-9a51-1c2d3e4f5a6b", "version-0": "0", "name-0": "Forged",
        "amount-0": "", "currency-0": "MKD" } });
    const html = await response.text();
    expect(html).toContain(t("providerServices.rowRemovedElsewhere"));
    expect(html).not.toContain(t("records.saved"));
    await page.reload();
    await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue(t("providerServices.suggestedFirst"));
    // The same submission without the site Origin is refused before reaching the API.
    const crossSite = await context.request.post(`${origin}/en/provider/services`,
      { multipart: { ...fields, rows: "1", "name-0": "Cross-site", "amount-0": "", "currency-0": "MKD" } });
    expect(await crossSite.text()).toContain(`${t("account.forbidden")} ${t("records.keptInput")}`);
  } finally { await context.close(); }
});

test("a failed deletion is reported and the entry stays listed", async ({ page, request }) => {
  await openWorkspace(page);
  await addService(page, "Synthetic consultation", "120.50");
  await mode(request, "delete-fail");
  await entry(page, 1).getByLabel(t("providerServices.remove")).check();
  await saveList(page);
  await expect(summaryOf(page)).toContainText(`${t("account.unavailable")} ${t("records.keptInput")}`);
  await page.reload();
  await expect(entry(page, 1).getByLabel(t("providerServices.name"))).toHaveValue("Synthetic consultation");
});

test("an API-reported unpublication after removing the last entry is shown", async ({ page, request }) => {
  await openWorkspace(page);
  await page.goto("/en/provider/profile");
  await page.getByRole("button", { name: t("profileEditor.create") }).click();
  await expect(page.getByLabel(t("profileEditor.displayName"))).toBeVisible();
  await addService(page, "Only service");
  await request.post(`${fixture}/control/profile/publish`);
  await page.reload();
  await expect(page.getByText(t("profileEditor.publication.published"))).toBeVisible();
  await entry(page, 1).getByLabel(t("providerServices.remove")).check();
  await saveList(page);
  await expect(page.getByText(t("records.saved"))).toBeVisible();
  await expect(page.getByText(t("profileEditor.publication.unpublished"))).toBeVisible();
});

test("an unavailable list hides the editor; anonymous visitors see sign-in only", async ({ page, request, playwright }) => {
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

test("the price list is keyboard accessible, fits 320 px and passes axe, including errors", async ({ page }) => {
  await openWorkspace(page);
  await addLocation(page);
  await addService(page, "Synthetic consultation", "0");
  const axe = async () => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  };
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/en/provider/services");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
  await fits();
  await axe();
  await entry(page, 2).getByText(t("providerServices.details"), { exact: true }).first().click();
  await entry(page, 2).getByRole("textbox", { name: t("providerServices.details") }).fill("Synthetic description");
  await fillEntry(page, 2, "Second", "abc");
  await saveList(page);
  await expect(summaryOf(page)).toBeFocused();
  await fits();
  await axe();
  await page.setViewportSize({ width: 320, height: 800 });
  await fits();
});
