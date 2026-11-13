import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const t = translator("en");
// A synthetic 1x1 PNG.
const png = { name: "diploma.png", mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") };
const feedback = "Synthetic feedback: the scan is unreadable.";

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/(auth/login\\?|v1/media/)`), async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
const control = (request: APIRequestContext, path: string) => request.post(`${fixture}/control/${path}`);
const mode = (request: APIRequestContext, value: string) => control(request, `identity/${value}`);

// Signs in, creates the workspace and a profile draft, and opens the credentials page.
async function openCredentials(page: Page, locale: Locale = "en") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/provider`);
  await page.getByRole("link", { name: tr("account.login") }).click();
  await expect(page.getByText(tr("account.authenticated"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/profile`);
  await page.getByRole("button", { name: tr("profileEditor.create") }).click();
  await expect(page.getByRole("heading", { name: tr("photo.heading") })).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/credentials`);
  await expect(page.getByRole("heading", { level: 1, name: tr("credentials.heading") })).toBeVisible();
}
async function fillCredential(page: Page, region: string, values: { title: string; issuedOn: string; expiresOn?: string },
  locale: Locale = "en") {
  const tr = translator(locale);
  const form = page.getByRole("region", { name: region });
  await form.getByLabel(tr("credential.type")).selectOption("SPECIALIZATION");
  await form.getByLabel(tr("credentials.title")).fill(values.title);
  await form.getByLabel(tr("credentials.issuer")).fill("Synthetic medical chamber");
  await form.getByLabel(tr("credentials.issuedOn")).fill(values.issuedOn);
  await form.getByLabel(tr("credentials.expiresOn")).fill(values.expiresOn ?? "");
  return form;
}
async function createCredential(page: Page, title = "Synthetic specialty", locale: Locale = "en") {
  const tr = translator(locale);
  const form = await fillCredential(page, tr("credentials.add"), { title, issuedOn: "2019-06-01", expiresOn: "2031-06-01" }, locale);
  await form.getByRole("button", { name: tr("credentials.create") }).click();
  await expect(page.getByText(tr("credentials.created"))).toBeVisible();
}
const card = (page: Page, title: string) => page.getByRole("article", { name: title });
async function addEvidence(page: Page, title: string, locale: Locale = "en") {
  const tr = translator(locale);
  await card(page, title).getByLabel(`${tr("media.file")}: ${title}`).setInputFiles(png);
  await card(page, title).getByRole("button", { name: tr("evidence.add") }).click();
  await expect(page.getByText(tr("evidence.saved"))).toBeVisible();
}
const submit = (page: Page, title: string, locale: Locale = "en") =>
  card(page, title).getByRole("button", { name: `${translator(locale)("credentials.submit")}: ${title}` });
const summaryOf = (page: Page) => page.getByRole("region", { name: t("records.problem") });

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of ["mk", "en"] as const) {
  test(`${locale}: submit, reject, correct, resubmit and approve a credential without JavaScript`, async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tr = translator(locale);
    await openCredentials(page, locale);
    await createCredential(page, "Synthetic specialty", locale);
    const item = card(page, "Synthetic specialty");
    await expect(item.getByText(tr("credential.state.draft"), { exact: true })).toBeVisible();
    // Submission needs evidence, so the button only appears once an image is attached.
    await expect(item.getByText(tr("credentials.evidenceRequired"))).toBeVisible();
    await expect(submit(page, "Synthetic specialty", locale)).toHaveCount(0);
    await addEvidence(page, "Synthetic specialty", locale);
    await submit(page, "Synthetic specialty", locale).click();
    await expect(page.getByText(tr("credentials.submitted"))).toBeVisible();
    await expect(item.getByText(tr("credential.state.submitted"), { exact: true })).toBeVisible();
    await expect(submit(page, "Synthetic specialty", locale)).toHaveCount(0);

    await control(request, `credentials/review?reject=${encodeURIComponent(feedback)}`);
    await page.reload();
    await expect(item.getByText(tr("credential.state.rejected"), { exact: true })).toBeVisible();
    await expect(item.getByRole("heading", { name: tr("credentials.feedback") })).toBeVisible();
    await expect(item.getByText(feedback)).toBeVisible();

    await item.getByRole("link", { name: new RegExp(`^${tr("records.edit")}`) }).click();
    const form = await fillCredential(page, tr("credentials.editHeading"), { title: "Synthetic specialty, corrected", issuedOn: "2019-06-01" }, locale);
    await form.getByRole("button", { name: tr("credentials.save") }).click();
    await expect(page.getByText(tr("credentials.saved"))).toBeVisible();
    const corrected = card(page, "Synthetic specialty, corrected");
    await expect(corrected.getByText(tr("credential.state.draft"), { exact: true })).toBeVisible();
    await expect(corrected.getByText(tr("credentials.noExpiry"))).toBeVisible();
    // Evidence survives a field edit; a new revision clears the earlier feedback.
    await expect(corrected.getByRole("img", { name: `${tr("evidence.image")} 1` })).toBeVisible();
    await expect(page.getByText(feedback)).toHaveCount(0);
    await submit(page, "Synthetic specialty, corrected", locale).click();
    await expect(page.getByText(tr("credentials.submitted"))).toBeVisible();

    await control(request, "credentials/review");
    await page.reload();
    await expect(corrected.getByText(tr("credential.state.approved"), { exact: true })).toBeVisible();
    await expect(corrected.getByText(tr("credentials.explain.approved"))).toBeVisible();
    expect(await page.content()).not.toMatch(privateValues);
    await context.close();
  });
}

test("editing an approved credential returns it to draft and the API's publication change is shown", async ({ page, request }) => {
  await openCredentials(page);
  await createCredential(page);
  await addEvidence(page, "Synthetic specialty");
  await submit(page, "Synthetic specialty").click();
  await expect(page.getByText(t("credentials.submitted"))).toBeVisible();
  await control(request, "credentials/review");
  await control(request, "profile/publish");
  await page.reload();
  await expect(page.getByText(t("profileEditor.publication.published"), { exact: true })).toBeVisible();

  await card(page, "Synthetic specialty").getByRole("link", { name: new RegExp(`^${t("records.edit")}`) }).click();
  await expect(page.getByText(t("credentials.reviewedEditNote"))).toBeVisible();
  // Re-sending the current values changes nothing.
  await page.getByRole("region", { name: t("credentials.editHeading") }).getByRole("button", { name: t("credentials.save") }).click();
  await expect(page.getByText(t("credentials.saved"))).toBeVisible();
  await expect(card(page, "Synthetic specialty").getByText(t("credential.state.approved"), { exact: true })).toBeVisible();

  await card(page, "Synthetic specialty").getByRole("link", { name: new RegExp(`^${t("records.edit")}`) }).click();
  const form = await fillCredential(page, t("credentials.editHeading"), { title: "Synthetic specialty", issuedOn: "2018-06-01" });
  await form.getByRole("button", { name: t("credentials.save") }).click();
  await expect(card(page, "Synthetic specialty").getByText(t("credential.state.draft"), { exact: true })).toBeVisible();
  await expect(page.getByText(t("profileEditor.publication.unpublished"), { exact: true })).toBeVisible();
});

test("stale edits keep input and show the latest version; stale submissions are refused", async ({ page, request }) => {
  await openCredentials(page);
  await createCredential(page);
  await addEvidence(page, "Synthetic specialty");
  await card(page, "Synthetic specialty").getByRole("link", { name: new RegExp(`^${t("records.edit")}`) }).click();
  const form = await fillCredential(page, t("credentials.editHeading"), { title: "Synthetic mine", issuedOn: "2019-06-01" });
  await control(request, "credentials/bump");
  await form.getByRole("button", { name: t("credentials.save") }).click();
  await expect(summaryOf(page)).toBeFocused();
  await expect(summaryOf(page).getByText(t("records.conflict"))).toBeVisible();
  await expect(page.getByRole("region", { name: t("records.latestHeading") }).getByText("Synthetic specialty")).toBeVisible();
  await expect(form.getByLabel(t("credentials.title"))).toHaveValue("Synthetic mine");
  await form.getByRole("button", { name: t("records.overwrite") }).click();
  await expect(page.getByText(t("credentials.saved"))).toBeVisible();
  await expect(card(page, "Synthetic mine").getByRole("img", { name: `${t("evidence.image")} 1` })).toBeVisible();

  await control(request, "credentials/bump");
  await submit(page, "Synthetic mine").click();
  await expect(page.getByRole("alert").filter({ hasText: t("credentials.conflict") })).toBeVisible();
  await expect(card(page, "Synthetic mine").getByText(t("credential.state.draft"), { exact: true })).toBeVisible();
});

// Foreign and unready evidence on credentials is covered in media.spec.ts.
test("invalid input is kept and explained; foreign and unknown credentials are not found", async ({ page, request }) => {
  await openCredentials(page);
  const form = await fillCredential(page, t("credentials.add"), { title: "Synthetic dates", issuedOn: "2020-01-15", expiresOn: "2019-01-15" });
  await form.getByRole("button", { name: t("credentials.create") }).click();
  await expect(summaryOf(page)).toBeFocused();
  await expect(summaryOf(page).getByRole("link", { name: `${t("credentials.expiresOn")}: ${t("records.error.dateOrder")}` })).toBeVisible();
  await expect(form.getByLabel(t("credentials.title"))).toHaveValue("Synthetic dates");
  // A future issue date is refused by the API, not guessed by the web.
  await form.getByLabel(t("credentials.issuedOn")).fill("2999-01-01");
  await form.getByLabel(t("credentials.expiresOn")).fill("");
  await form.getByRole("button", { name: t("credentials.create") }).click();
  await expect(summaryOf(page).getByText(t("records.rejected"))).toBeVisible();

  // An identifier that is not one of the owner's credentials opens nothing.
  const foreign = await (await control(request, "media/foreign")).json() as { mediaId: string };
  for (const query of [`edit=${foreign.mediaId}`, `remove=${foreign.mediaId}`, "edit=..%2Fprivate"]) {
    await page.goto(`${origin}/en/provider/credentials?${query}`);
    await expect(page.getByText(t("credentials.missing"))).toBeVisible();
    await expect(page.getByRole("heading", { name: t("credentials.editHeading") })).toHaveCount(0);
    await expect(page.getByRole("img")).toHaveCount(0);
  }
});

test("removal needs confirmation and deletes the credential with its evidence", async ({ page, request }) => {
  await openCredentials(page);
  await createCredential(page);
  await addEvidence(page, "Synthetic specialty");
  const src = (await card(page, "Synthetic specialty").getByRole("img").getAttribute("src"))!;
  await card(page, "Synthetic specialty").getByRole("link", { name: new RegExp(`^${t("records.remove")}`) }).click();
  const confirmation = page.getByRole("region", { name: t("credentials.removeHeading") });
  await expect(confirmation.getByText(t("credentials.removeNote"))).toBeVisible();
  await confirmation.getByRole("link", { name: t("records.cancel") }).click();
  await expect(card(page, "Synthetic specialty")).toBeVisible();
  await card(page, "Synthetic specialty").getByRole("link", { name: new RegExp(`^${t("records.remove")}`) }).click();
  await page.getByRole("button", { name: t("records.removeConfirm") }).click();
  await expect(page.getByText(t("credentials.removed"))).toBeVisible();
  await expect(card(page, "Synthetic specialty")).toHaveCount(0);
  await expect(page.getByText(t("evidence.none"))).toBeVisible();
  expect((await request.get(fixture + src)).status()).not.toBe(200);
});

test("the credentials page is responsive, never indexed and passes axe", async ({ page }) => {
  await openCredentials(page);
  await createCredential(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
});
