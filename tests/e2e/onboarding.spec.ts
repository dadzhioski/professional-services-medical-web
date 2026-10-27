import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator, type Locale } from "../../src/lib/i18n";
import type { TranslationKey } from "../../src/lib/i18n/en";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const skopje = "0a6b1c2d-0000-4000-8000-000000000001";

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(`${origin}/api/auth/login?*`, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
// Signing in returns to /[locale]/provider, which lands on the checklist.
async function signIn(page: Page, locale: Locale = "en") {
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: translator(locale)("account.login") }).click();
  await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
  await expect(page.getByText(translator(locale)("account.authenticated"))).toBeVisible();
}
const mode = (request: { post: (url: string) => Promise<unknown> }, value: string) => request.post(`${fixture}/control/identity/${value}`);
const t = translator("en");
const nextStep = (page: Page, locale: Locale = "en") => page.getByRole("region", { name: translator(locale)("onboarding.next") });
const step = (page: Page, key: TranslationKey, locale: Locale = "en") => page.getByRole("region", { name: translator(locale)("onboarding.checklist") })
  .getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: translator(locale)(key), exact: true }) });
async function expectCurrent(page: Page, key: TranslationKey) {
  await expect(step(page, key)).toHaveAttribute("aria-current", "step");
  await expect(step(page, key)).toContainText(t("onboarding.state.current"));
  await expect(nextStep(page).getByRole("heading", { level: 3 })).toHaveText(t(key));
}
async function backToChecklist(page: Page) {
  await page.getByRole("main").getByRole("link", { name: t("onboarding.backToChecklist") }).first().click();
  await expect(page).toHaveURL(`${origin}/en/provider/onboarding`);
}

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of localeCodes) {
  test(`${locale}: sign-in lands on the checklist; first onboarding and resume without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tl = translator(locale);
    try {
      await signIn(page, locale);
      await expect(nextStep(page, locale).getByText(tl("workspace.missing"))).toBeVisible();
      await expect(step(page, "onboarding.step.workspace", locale)).toHaveAttribute("aria-current", "step");
      await expect(page.getByRole("region", { name: tl("onboarding.checklist") }).getByRole("link")).toHaveCount(0);
      await page.getByRole("button", { name: tl("onboarding.create") }).click();
      await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
      await expect(page.getByText(tl("workspace.ready"))).toBeVisible();
      await expect(step(page, "onboarding.step.workspace", locale)).toContainText(tl("onboarding.state.done"));
      await expect(step(page, "onboarding.step.profile", locale)).toHaveAttribute("aria-current", "step");
      await expect(page.getByText(tl("workspace.approval.pending"))).toBeVisible();
      const response = await page.goto(`${origin}/${locale}/provider`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      await expect(page).toHaveURL(`${origin}/${locale}/provider/onboarding`);
      await expect(page.getByRole("button", { name: tl("onboarding.create") })).toHaveCount(0);
      expect(await response!.text()).not.toMatch(privateValues);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    } finally { await context.close(); }
  });
}

test("each saved step updates the checklist on the next request without JavaScript", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  const page = await context.newPage();
  try {
    await signIn(page);
    await page.getByRole("button", { name: t("onboarding.create") }).click();
    await expectCurrent(page, "onboarding.step.profile");
    await expect(step(page, "onboarding.step.publication")).toContainText(t("onboarding.reason.completeAbove"));

    // Profile: name and introduction first; the specialty keeps the step open.
    await nextStep(page).getByRole("link", { name: new RegExp(`^${t("onboarding.action.open")}`) }).click();
    await expect(page).toHaveURL(`${origin}/en/provider/profile`);
    await page.getByRole("button", { name: t("profileEditor.create") }).click();
    await page.getByLabel(t("profileEditor.displayName")).fill("Dr. Checklist Synthetic");
    await page.getByLabel(t("profileEditor.biography")).fill("Synthetic checklist biography");
    await page.getByRole("button", { name: t("profileEditor.save"), exact: true }).click();
    await expect(page.getByText(t("profileEditor.saved"))).toBeVisible();
    await backToChecklist(page);
    await expectCurrent(page, "onboarding.step.profile");
    await expect(nextStep(page)).toContainText(t("publication.missing.specialty"));
    await expect(nextStep(page)).not.toContainText(t("publication.missing.displayName"));

    await page.goto(`${origin}/en/provider/profile`);
    await page.getByLabel(t("specialtyEditor.label"), { exact: true }).selectOption({ label: "Cardiology" });
    await page.getByRole("button", { name: t("specialtyEditor.save") }).click();
    await expect(page.getByText(t("specialtyEditor.saved"))).toBeVisible();
    await backToChecklist(page);
    await expect(step(page, "onboarding.step.profile")).toContainText(t("onboarding.state.done"));
    await expectCurrent(page, "onboarding.step.service");

    await nextStep(page).getByRole("link", { name: new RegExp(`^${t("onboarding.action.open")}`) }).click();
    const service = page.getByRole("region", { name: t("providerServices.add") });
    await service.getByLabel(t("providerServices.name")).fill("Checklist consultation");
    await service.getByRole("button", { name: t("providerServices.create") }).click();
    await expect(page.getByText(t("records.saved"))).toBeVisible();
    await backToChecklist(page);
    await expectCurrent(page, "onboarding.step.location");

    await nextStep(page).getByRole("link", { name: new RegExp(`^${t("onboarding.action.open")}`) }).click();
    const location = page.getByRole("region", { name: t("providerLocations.add") });
    await location.getByLabel(t("providerLocations.label")).fill("Checklist Clinic");
    await location.getByLabel(t("providerLocations.address")).fill("1 Checklist Street");
    await location.getByLabel(t("providerLocations.country")).selectOption("MK");
    await location.getByLabel(t("providerLocations.city")).selectOption(skopje);
    await location.getByRole("button", { name: t("providerLocations.create") }).click();
    await expect(page.getByText(t("records.saved"))).toBeVisible();
    await backToChecklist(page);
    await expectCurrent(page, "onboarding.step.credentials");
    await expect(nextStep(page)).toContainText(t("onboarding.credential.add"));

    await nextStep(page).getByRole("link", { name: new RegExp(`^${t("onboarding.action.open")}`) }).click();
    const form = page.getByRole("region", { name: t("credentials.add") });
    await form.getByLabel(t("credential.type")).selectOption("LICENSE");
    await form.getByLabel(t("credentials.title")).fill("Checklist licence");
    await form.getByLabel(t("credentials.issuer")).fill("Synthetic medical chamber");
    await form.getByLabel(t("credentials.issuedOn")).fill("2019-06-01");
    await form.getByRole("button", { name: t("credentials.create") }).click();
    await expect(page.getByText(t("credentials.created"))).toBeVisible();
    await backToChecklist(page);
    await expect(nextStep(page)).toContainText(t("onboarding.credential.submit"));

    await page.goto(`${origin}/en/provider/credentials`);
    const card = page.getByRole("article", { name: "Checklist licence" });
    await card.getByLabel(`${t("media.file")}: Checklist licence`).setInputFiles({ name: "licence.png", mimeType: "image/png", buffer: png });
    await card.getByRole("button", { name: t("evidence.add") }).click();
    await expect(page.getByText(t("evidence.saved"))).toBeVisible();
    await page.getByRole("article", { name: "Checklist licence" }).getByRole("button", { name: `${t("credentials.submit")}: Checklist licence` }).click();
    await expect(page.getByText(t("credentials.submitted"))).toBeVisible();
    await backToChecklist(page);
    await expectCurrent(page, "onboarding.step.credentials");
    await expect(nextStep(page)).toContainText(t("onboarding.credential.waiting"));
    for (const key of ["onboarding.step.workspace", "onboarding.step.profile", "onboarding.step.service", "onboarding.step.location"] as const) {
      await expect(step(page, key)).toContainText(t("onboarding.state.done"));
    }
    await expect(step(page, "onboarding.step.photo")).toContainText(t("onboarding.state.optional"));
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    expect(await page.content()).not.toMatch(privateValues);
  } finally { await context.close(); }
});

test("repeated submission is prevented and retries reuse the same workspace", async ({ page }) => {
  await signIn(page);
  const button = page.getByRole("button", { name: t("onboarding.create") });
  await button.dblclick();
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(step(page, "onboarding.step.workspace")).toContainText(t("onboarding.state.done"));
});

test("ambiguous failure recovers from current context; failure never looks successful", async ({ page, request }) => {
  await signIn(page);
  await mode(request, "onboard-down");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.unavailable"))).toBeVisible();
  await expect(page.getByText(t("workspace.ready"))).toHaveCount(0);
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
  await mode(request, "onboard-lost");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page).toHaveURL(`${origin}/en/provider/onboarding`);
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
});

test("existing membership resumes in a new session; other accounts stay isolated", async ({ page, browser, request }) => {
  await mode(request, "same-account");
  await signIn(page);
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

test("expired, unverified, forbidden and unavailable states stay safe and never show a step as done", async ({ page, request }) => {
  await signIn(page);
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
  for (const [value, key] of [["expired", "expired"], ["unverified", "forbidden"], ["down", "unavailable"], ["context-down", "unavailable"]] as const) {
    await mode(request, value);
    const response = await page.goto("/en/provider/onboarding");
    await expect(page.getByText(t(`account.${key}`))).toBeVisible();
    await expect(page.getByText(t("onboarding.state.done"), { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: t("onboarding.create") })).toHaveCount(0);
    expect(await response!.text()).not.toMatch(/synthetic-private-error/);
  }
  await mode(request, "reset");
  await signIn(page);
  await mode(request, "expired");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.expired"))).toBeVisible();
  await mode(request, "bad-csrf");
  await page.goto("/en/provider/onboarding");
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("account.forbidden"))).toBeVisible();
  await expect(step(page, "onboarding.step.workspace")).toHaveAttribute("aria-current", "step");
});

test("API restriction is presented without inventing permissions", async ({ page, request }) => {
  await signIn(page);
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await mode(request, "suspended");
  await page.reload();
  await expect(page.getByText(t("workspace.suspended"))).toBeVisible();
  await expect(page.getByRole("button", { name: t("workspace.resubmit") })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(t("onboarding.step.publication")) })).toHaveCount(0);
});

test("submissions ignore foreign identifiers and require the site Origin", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  try {
    const page = await context.newPage();
    await signIn(page);
    const fields = await page.locator("main form input").evaluateAll(inputs => Object.fromEntries(
      inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
    const crossSite = await context.request.post(`${origin}/en/provider/onboarding`, { multipart: fields, maxRedirects: 0 });
    expect(crossSite.headers().location).toBe("/en/provider/onboarding?notice=forbidden");
    await page.reload();
    await expect(step(page, "onboarding.step.workspace")).toHaveAttribute("aria-current", "step");
    const forged = await context.request.post(`${origin}/en/provider/onboarding`, { maxRedirects: 0, headers: { Origin: origin },
      multipart: { ...fields, organizationId: "foreign-org", role: "ADMIN" } });
    expect(forged.headers().location).toBe("/en/provider/onboarding");
    await page.goto(`${origin}/en/provider`);
    await expect(page.getByText(t("workspace.ready"))).toBeVisible();
    expect(await page.content()).not.toMatch(/foreign-org|ADMIN/);
  } finally { await context.close(); }
});

test("the workspace path keeps only known query values", async ({ request }) => {
  const response = await request.get(`${origin}/en/provider?notice=expired&approval=resubmitted&token=private`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/provider/onboarding?notice=expired&approval=resubmitted");
  expect((await request.get(`${origin}/fr/provider`, { maxRedirects: 0 })).status()).toBe(404);
});

test("the checklist is keyboard accessible, fits 320 px and passes axe", async ({ page }) => {
  await signIn(page);
  for (const created of [false, true]) {
    if (created) await page.getByRole("button", { name: t("onboarding.create") }).click();
    for (const viewport of [page.viewportSize()!, { width: 320, height: 640 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/en/provider/onboarding");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const action = nextStep(page).getByRole(created ? "link" : "button").first();
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      for (const link of await page.getByRole("region", { name: t("onboarding.checklist") }).getByRole("link").all()) {
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await action.focus();
      await expect(action).toBeFocused();
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
    }
  }
});
