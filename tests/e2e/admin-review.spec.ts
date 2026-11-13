import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
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

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/(auth/login\\?|v1/media/|v1/admin/media/)`), async route => {
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
// A doctor with a workspace and a profile draft.
async function doctor(page: Page, locale: Locale = "en") {
  const tr = translator(locale);
  await signIn(page, locale);
  await page.goto(`${origin}/${locale}/provider/onboarding`);
  await page.getByRole("button", { name: tr("onboarding.create") }).click();
  await expect(page.getByText(tr("workspace.ready"))).toBeVisible();
  await page.goto(`${origin}/${locale}/provider/profile`);
  await page.getByRole("button", { name: tr("profileEditor.create") }).click();
  await expect(page.getByRole("heading", { name: tr("photo.heading") })).toBeVisible();
}
// A separate browser session for the administrator; the grant is the operator bootstrap, never a web action.
async function administrator(browser: Browser, request: APIRequestContext, options: { javaScriptEnabled?: boolean } = {}) {
  const context = await browser.newContext(options);
  await navigation(context);
  const page = await context.newPage();
  await signIn(page);
  await control(request, "admin/grant");
  return { context, page };
}
async function openDoctor(page: Page, locale: Locale = "en", state = "PENDING") {
  const tr = translator(locale);
  await page.goto(`${origin}/${locale}/admin/doctors?state=${state}`);
  await page.getByRole("link", { name: new RegExp(`^${tr("review.open")}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: tr("review.doctor.heading") })).toBeVisible();
}
async function decide(page: Page, action: "approve" | "reject" | "suspend" | "reinstate", reason?: string, locale: Locale = "en") {
  const tr = translator(locale);
  await page.getByRole("link", { name: tr(`review.action.${action}`), exact: true }).click();
  const confirmation = page.locator("section[aria-labelledby=decision]");
  if (reason !== undefined) await confirmation.getByLabel(tr("review.reason")).fill(reason);
  await confirmation.getByRole("button", { name: tr(`review.action.${action}`) }).click();
}

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

test("signed-out, non-administrator and expired accounts never see review data", async ({ page, request }) => {
  await page.goto(`${origin}/en/admin/doctors`);
  await expect(page.getByText(t("account.signedOut"))).toBeVisible();
  await expect(page.getByRole("link", { name: t("account.login") })).toHaveAttribute("href", /returnTo=%2Fen%2Fprovider/);
  await doctor(page);
  for (const path of ["/en/admin/doctors", "/en/admin/credentials"]) {
    await page.goto(origin + path);
    await expect(page.getByText(t("admin.denied"))).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`^${t("review.open")}`) })).toHaveCount(0);
  }
  await mode(request, "expired");
  await page.goto(`${origin}/en/admin/credentials`);
  await expect(page.getByText(t("account.expired"))).toBeVisible();
  expect(await page.content()).not.toMatch(privateValues);
});

test("rejection, owner resubmission and approval work without JavaScript", async ({ page, browser, request }) => {
  await doctor(page);
  const admin = await administrator(browser, request, { javaScriptEnabled: false });
  try {
    await openDoctor(admin.page);
    await expect(admin.page.getByText(t("review.separation")).first()).toBeVisible();
    await decide(admin.page, "reject", "Synthetic reason: add your registration body.");
    await expect(admin.page.getByText(t("review.outcome.rejected"))).toBeVisible();
    await expect(admin.page.getByText(t("review.approvalDecided"))).toBeVisible();

    await page.goto(`${origin}/en/provider`);
    await expect(page.getByText(t("workspace.approval.rejected"))).toBeVisible();
    await expect(page.getByText("Synthetic reason: add your registration body.")).toBeVisible();
    await page.getByRole("button", { name: t("workspace.resubmit") }).click();
    await expect(page.getByText(t("workspace.outcome.resubmitted"))).toBeVisible();
    await expect(page.getByText(t("workspace.approval.pending"))).toBeVisible();
    await expect(page.getByText("Synthetic reason")).toHaveCount(0);

    await openDoctor(admin.page);
    await decide(admin.page, "approve");
    await expect(admin.page.getByText(t("review.outcome.approved"))).toBeVisible();
    await page.reload();
    await expect(page.getByText(t("workspace.approval.approved"), { exact: true })).toBeVisible();
  } finally { await admin.context.close(); }
});

test("a stale decision is refused and the refreshed revision must be reviewed again", async ({ page, browser, request }) => {
  await doctor(page);
  const admin = await administrator(browser, request);
  try {
    await openDoctor(admin.page);
    await admin.page.getByRole("link", { name: t("review.action.approve"), exact: true }).click();
    await control(request, "review/bump");
    await admin.page.locator("section[aria-labelledby=decision]").getByRole("button", { name: t("review.action.approve") }).click();
    await expect(admin.page.getByText(t("review.outcome.conflict"))).toBeVisible();
    // Nothing was resubmitted automatically.
    await expect(admin.page.getByText(t("workspace.approval.pending"))).toBeVisible();
    await decide(admin.page, "approve");
    await expect(admin.page.getByText(t("review.outcome.approved"))).toBeVisible();
  } finally { await admin.context.close(); }
});

test("suspension unpublishes and blocks edits; reinstatement does not republish", async ({ page, browser, request }) => {
  await doctor(page);
  await control(request, "profile/complete");
  await control(request, "credentials/seed");
  const admin = await administrator(browser, request);
  try {
    await openDoctor(admin.page);
    await decide(admin.page, "approve");
    await page.goto(`${origin}/en/provider/publication`);
    await page.getByRole("link", { name: t("publication.publish") }).click();
    await page.getByRole("button", { name: t("publication.publish") }).click();
    await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();

    await openDoctor(admin.page, "en", "APPROVED");
    await decide(admin.page, "suspend");
    await expect(admin.page.getByText(t("review.outcome.suspended"))).toBeVisible();
    await expect(admin.page.getByText(t("profileEditor.publication.unpublished"))).toBeVisible();

    await page.reload();
    await expect(page.getByText(t("publication.suspended"))).toBeVisible();
    await expect(page.getByText(t("profileEditor.publication.unpublished"))).toBeVisible();
    await expect(page.getByRole("link", { name: t("publication.publish") })).toHaveCount(0);
    await page.goto(`${origin}/en/provider/profile`);
    await page.getByLabel(t("profileEditor.displayName")).fill("Dr. Blocked Edit");
    await page.getByRole("button", { name: t("profileEditor.save") }).click();
    await expect(page.getByText(t("account.forbidden")).first()).toBeVisible();

    await decide(admin.page, "reinstate");
    await expect(admin.page.getByText(t("review.outcome.reinstated"))).toBeVisible();
    await page.goto(`${origin}/en/provider/publication`);
    await expect(page.getByText(t("profileEditor.publication.unpublished"))).toBeVisible();
    await expect(page.getByText(t("publication.republishNote"))).toBeVisible();
    await expect(page.getByRole("link", { name: t("publication.publish") })).toBeVisible();
  } finally { await admin.context.close(); }
});

test("credential review shows private evidence to the administrator and returns decisions to the owner", async ({ page, browser, request }) => {
  await doctor(page);
  await page.goto(`${origin}/en/provider/credentials`);
  const form = page.getByRole("region", { name: t("credentials.add") });
  await form.getByLabel(t("credential.type")).selectOption("LICENSE");
  await form.getByLabel(t("credentials.title")).fill("Synthetic licence");
  await form.getByLabel(t("credentials.issuer")).fill("Synthetic medical chamber");
  await form.getByLabel(t("credentials.issuedOn")).fill("2019-06-01");
  await form.getByRole("button", { name: t("credentials.create") }).click();
  const card = page.getByRole("article", { name: "Synthetic licence" });
  await card.getByLabel(`${t("media.file")}: Synthetic licence`).setInputFiles(png);
  await card.getByRole("button", { name: t("evidence.add") }).click();
  await card.getByRole("button", { name: `${t("credentials.submit")}: Synthetic licence` }).click();
  await expect(page.getByText(t("credentials.submitted"))).toBeVisible();

  const admin = await administrator(browser, request);
  try {
    await admin.page.goto(`${origin}/en/admin/credentials`);
    await admin.page.getByRole("link", { name: new RegExp(`^${t("review.open")}\\s*: Synthetic licence`) }).click();
    const image = admin.page.getByRole("img", { name: `${t("evidence.image")} 1` });
    await expect(image).toHaveAttribute("src", /^\/api\/v1\/admin\/media\/[0-9a-f-]{36}\/content$/);
    expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1);
    await decide(admin.page, "reject", "Synthetic reason: the scan is unreadable.");
    await expect(admin.page.getByText(t("review.outcome.rejected"))).toBeVisible();
    await expect(admin.page.getByText(t("review.credentialDecided"))).toBeVisible();

    await page.reload();
    await expect(card.getByText(t("credential.state.rejected"), { exact: true })).toBeVisible();
    await expect(card.getByText("Synthetic reason: the scan is unreadable.")).toBeVisible();
    await card.getByRole("button", { name: `${t("credentials.submit")}: Synthetic licence` }).click();
    await expect(page.getByText(t("credentials.submitted"))).toBeVisible();

    await admin.page.reload();
    await decide(admin.page, "approve");
    await expect(admin.page.getByText(t("review.outcome.approved"))).toBeVisible();
    await page.reload();
    await expect(card.getByText(t("credential.state.approved"), { exact: true })).toBeVisible();
    // Doctor approval is a separate decision: the doctor is still pending.
    await openDoctor(admin.page);
    await expect(admin.page.getByText(t("workspace.approval.pending"))).toBeVisible();
  } finally { await admin.context.close(); }
});

test("administrator pages are responsive, never indexed and pass axe", async ({ page, browser, request }) => {
  await doctor(page);
  const admin = await administrator(browser, request);
  try {
    for (const path of ["/en/admin/doctors", "/en/admin/credentials"]) {
      await admin.page.goto(origin + path);
      await expect(admin.page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    }
    await openDoctor(admin.page);
    await admin.page.getByRole("link", { name: t("review.action.reject"), exact: true }).click();
    await expect(admin.page.getByLabel(t("review.reason"))).toBeVisible();
    await expect(admin.page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(await admin.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await admin.page.content()).not.toMatch(privateValues);
    await admin.page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await admin.page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  } finally { await admin.context.close(); }
});
