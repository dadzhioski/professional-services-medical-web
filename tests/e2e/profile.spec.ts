import { test, expect, type BrowserContext, type Page } from "@playwright/test";
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
// Signs in, creates the workspace and an empty draft, and opens the editor.
async function openDraft(page: Page, locale: Locale = "en") {
  const tr = translator(locale);
  await signIn(page, locale);
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/profile`);
  await page.getByRole("button", { name: tr("profileEditor.create") }).click();
  await expect(page.getByLabel(tr("profileEditor.displayName"))).toBeVisible();
}
const slugOf = async (page: Page) => (await page.locator("dd code").textContent())!;
const mode = (request: { post: (url: string) => Promise<unknown> }, value: string) => request.post(`${fixture}/control/identity/${value}`);
const bump = (request: { post: (url: string) => Promise<unknown> }) => request.post(`${fixture}/control/profile/bump`);
const name = (page: Page) => page.getByLabel(t("profileEditor.displayName"));
const biography = (page: Page) => page.getByLabel(t("profileEditor.biography"));
// The summary is a named region; Next.js also renders its own route announcer with the alert role.
const summaryOf = (page: Page) => page.getByRole("region", { name: t("profileEditor.problem") });
const save = (page: Page) => page.getByRole("button", { name: t("profileEditor.save"), exact: true }).click();

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of localeCodes) {
  test(`${locale}: create, edit and preview a private draft without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tr = translator(locale);
    try {
      await openDraft(page, locale);
      await expect(page.getByText(tr("profileEditor.publication.draft"))).toBeVisible();
      await expect(page.getByText(tr("profileEditor.unnamed"))).toBeVisible();
      const slug = await slugOf(page);
      expect(slug).toMatch(/^dr-[0-9a-f]{8}$/);
      await page.getByLabel(tr("profileEditor.displayName")).fill("Dr. Synthetic Draft");
      await page.getByLabel(tr("profileEditor.biography")).fill("Synthetic line one\nSynthetic line two");
      await page.getByRole("button", { name: tr("profileEditor.save"), exact: true }).click();
      await expect(page.getByRole("status").first()).toHaveText(tr("profileEditor.saved"));
      const response = await page.goto(`${origin}/${locale}/provider/profile`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      await expect(page.getByLabel(tr("profileEditor.displayName"))).toHaveValue("Dr. Synthetic Draft");
      await expect(page.getByRole("region", { name: tr("profileEditor.previewHeading") })).toContainText("Synthetic line two");
      expect(await slugOf(page)).toBe(slug);
      expect(await response!.text()).not.toMatch(privateValues);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    } finally { await context.close(); }
  });
}

test("saves with JavaScript, keeps the slug stable and prevents repeated submission", async ({ page }) => {
  await openDraft(page);
  const slug = await slugOf(page);
  await name(page).fill("Dr. Synthetic Renamed");
  await page.getByRole("button", { name: t("profileEditor.save"), exact: true }).dblclick();
  await expect(page.getByRole("status").first()).toHaveText(t("profileEditor.saved"));
  await expect(page.getByRole("region", { name: t("profileEditor.previewHeading") })).toContainText("Dr. Synthetic Renamed");
  await name(page).fill("Dr. Synthetic Second");
  await save(page);
  await expect(summaryOf(page)).toHaveCount(0);
  await page.reload();
  await expect(name(page)).toHaveValue("Dr. Synthetic Second");
  expect(await slugOf(page)).toBe(slug);
});

test("rejected input is kept and keyboard users reach the field from the summary", async ({ page, request }) => {
  await openDraft(page);
  await biography(page).fill("Synthetic biography kept");
  await name(page).evaluate(input => input.removeAttribute("maxlength"));
  await name(page).fill("x".repeat(256));
  await name(page).press("Enter");
  const summary = summaryOf(page);
  await expect(summary).toBeFocused();
  await expect(summary).toContainText(t("profileEditor.invalid"));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(name(page)).toBeFocused();
  await expect(name(page)).toHaveAttribute("aria-invalid", "true");
  await expect(biography(page)).toHaveValue("Synthetic biography kept");
  await mode(request, "profile-reject");
  await name(page).fill("Dr. Synthetic");
  await save(page);
  await expect(summaryOf(page)).toContainText(t("profileEditor.invalid"));
  await expect(name(page)).toHaveValue("Dr. Synthetic");
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
});

test("a stale edit is reviewed and never silently overwritten", async ({ page, request }) => {
  await openDraft(page);
  await bump(request);
  await name(page).fill("Dr. Mine");
  await save(page);
  await expect(summaryOf(page)).toContainText(t("profileEditor.conflict"));
  await expect(page.getByRole("region", { name: t("profileEditor.latestHeading") })).toContainText("Edited elsewhere");
  await expect(name(page)).toHaveValue("Dr. Mine");
  // Saving again without choosing still conflicts.
  await save(page);
  await expect(summaryOf(page)).toContainText(t("profileEditor.conflict"));
  await page.getByRole("button", { name: t("profileEditor.overwrite") }).click();
  await expect(page.getByRole("status").first()).toHaveText(t("profileEditor.saved"));
  await page.reload();
  await expect(name(page)).toHaveValue("Dr. Mine");
  await bump(request);
  await name(page).fill("Dr. Discarded");
  await save(page);
  await page.getByRole("link", { name: t("profileEditor.discard") }).click();
  await expect(name(page)).toHaveValue("Edited elsewhere");
});

test("unavailable API, lost session and restriction keep unsaved input", async ({ page, request }) => {
  await openDraft(page);
  for (const [value, key] of [["profile-down", "unavailable"], ["expired", "expired"], ["suspended", "forbidden"], ["bad-csrf", "forbidden"]] as const) {
    await mode(request, "up");
    await page.reload();
    await mode(request, value);
    await name(page).fill(`Dr. Unsaved ${value}`);
    await save(page);
    const alert = summaryOf(page);
    await expect(alert).toContainText(t(`account.${key}`));
    await expect(alert).toContainText(t("profileEditor.keptInput"));
    await expect(name(page)).toHaveValue(`Dr. Unsaved ${value}`);
    if (key === "expired") await expect(alert.getByRole("link", { name: t("account.login") })).toBeVisible();
    expect(await page.content()).not.toMatch(/synthetic-private-error/);
  }
  await mode(request, "suspended");
  await page.reload();
  await expect(page.getByText(t("workspace.suspended"))).toBeVisible();
  await mode(request, "profile-down");
  await page.reload();
  await expect(page.getByText(t("account.unavailable"))).toBeVisible();
  await expect(name(page)).toHaveCount(0);
});

test("submissions require the site Origin and ignore foreign identifiers", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    await openDraft(page);
    const slug = await slugOf(page);
    const fields = await page.locator("main form").first().locator("input, textarea").evaluateAll(inputs => Object.fromEntries(
      inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
    const crossSite = await context.request.post(`${origin}/en/provider/profile`, { multipart: { ...fields, displayName: "Cross-site" } });
    const crossSiteHtml = await crossSite.text();
    expect(crossSiteHtml).toContain(`<p>${t("account.forbidden")} ${t("profileEditor.keptInput")}</p>`);
    expect(crossSiteHtml).toContain('<div role="status"></div>');
    await page.reload();
    await expect(name(page)).toHaveValue("");
    const forged = await context.request.post(`${origin}/en/provider/profile`, { headers: { Origin: origin },
      multipart: { ...fields, displayName: "Dr. Forged Fields", slug: "dr-foreign", organizationId: "foreign-org" } });
    expect(await forged.text()).toContain(`<div role="status"><p class="rounded-lg border border-teal-700 bg-teal-50 p-4 text-teal-950">${t("profileEditor.saved")}</p></div>`);
    await page.reload();
    await expect(name(page)).toHaveValue("Dr. Forged Fields");
    expect(await slugOf(page)).toBe(slug);
    expect(await page.content()).not.toMatch(/dr-foreign|foreign-org/);
  } finally { await context.close(); }
});

test("drafts never reach anonymous visitors or other accounts", async ({ page, browser, playwright }) => {
  await openDraft(page);
  const slug = await slugOf(page);
  await name(page).fill("Dr. Private Draft Name");
  await save(page);
  await expect(page.getByRole("status").first()).toBeVisible();
  const anonymous = await playwright.request.newContext();
  try {
    for (const path of ["/en/provider/profile", "/mk/provider/profile", `/mk/doctors/${slug}`, `/en/doctors/${slug}`]) {
      const response = await anonymous.get(`${origin}${path}`);
      const html = await response.text();
      expect(html).not.toContain("Dr. Private Draft Name");
      // A not-found page may echo the requested path; the editor pages must not expose the slug.
      if (path.includes("/doctors/")) expect(response.status()).toBe(404);
      else expect(html).not.toContain(slug);
    }
  } finally { await anonymous.dispose(); }
  const other = await browser.newContext();
  await navigation(other);
  try {
    const otherPage = await other.newPage();
    await openDraft(otherPage);
    expect(await slugOf(otherPage)).not.toBe(slug);
    expect(await otherPage.content()).not.toContain("Dr. Private Draft Name");
  } finally { await other.close(); }
});

test("the editor is keyboard accessible, responsive and passes axe, including errors", async ({ page, request }) => {
  await openDraft(page);
  await page.goto("/en/provider/profile");
  const axe = async () => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  };
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe();
  await bump(request);
  await name(page).fill("x".repeat(255));
  await save(page);
  await expect(summaryOf(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe();
});
