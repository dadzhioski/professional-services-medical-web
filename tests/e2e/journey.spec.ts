import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { localeCodes, translator } from "../../src/lib/i18n";

// Milestone 1 acceptance: one doctor goes from sign-in to anonymous public reading through the web UI only.
// The administrator grant is the operator bootstrap, the only fixture control used to build the journey.
const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const skopje = "0a6b1c2d-0000-4000-8000-000000000001";
const t = translator("en");
const doctorName = "Dr. Journey Synthetic";
// Synthetic images only: a 1x1 PNG and a PDF the upload must refuse.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const photoFile = { name: "photo.png", mimeType: "image/png", buffer: png };
const evidenceFile = { name: "diploma.png", mimeType: "image/png", buffer: png };
const pdfFile = { name: "record.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 synthetic") };

// Stand in for the existing Caddy /api/* routing, only in the browser fixture.
async function navigation(context: BrowserContext) {
  await context.route(new RegExp(`^${origin}/api/(auth/login\\?|v1/media/|v1/admin/media/|v1/public/media/)`), async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture + url.pathname + url.search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}
const control = (request: APIRequestContext, path: string) => request.post(`${fixture}/control/${path}`);
const mode = (request: APIRequestContext, value: string) => control(request, `identity/${value}`);
async function session(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  await navigation(context);
  return { context, page: await context.newPage() };
}
async function signIn(page: Page) {
  await page.goto(`${origin}/en/provider`);
  await page.getByRole("link", { name: t("account.login") }).click();
  await expect(page.getByText(t("account.authenticated"))).toBeVisible();
}
async function onboard(page: Page) {
  await signIn(page);
  await page.goto(`${origin}/en/provider/onboarding`);
  await page.getByRole("button", { name: t("onboarding.create") }).click();
  await expect(page.getByText(t("workspace.ready"))).toBeVisible();
  await page.goto(`${origin}/en/provider/profile`);
  await page.getByRole("button", { name: t("profileEditor.create") }).click();
  await expect(page.getByLabel(t("profileEditor.displayName"))).toBeVisible();
}
async function createCredential(page: Page, title: string) {
  const form = page.getByRole("region", { name: t("credentials.add") });
  await form.getByLabel(t("credential.type")).selectOption("LICENSE");
  await form.getByLabel(t("credentials.title")).fill(title);
  await form.getByLabel(t("credentials.issuer")).fill("Synthetic medical chamber");
  await form.getByLabel(t("credentials.issuedOn")).fill("2019-06-01");
  await form.getByRole("button", { name: t("credentials.create") }).click();
  return page.getByRole("article", { name: title });
}
// Every owner-provided part through its own editor, then one credential with evidence submitted for review.
async function prepareDoctor(page: Page) {
  await onboard(page);
  await page.getByLabel(t("profileEditor.displayName")).fill(doctorName);
  await page.getByLabel(t("profileEditor.biography")).fill("Synthetic journey biography");
  await page.getByRole("button", { name: t("profileEditor.save"), exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText(t("profileEditor.saved"));
  await page.getByLabel(t("specialtyEditor.label"), { exact: true }).selectOption({ label: "Cardiology" });
  await page.getByRole("button", { name: t("specialtyEditor.save") }).click();
  await expect(page.getByText(t("specialtyEditor.saved"))).toBeVisible();

  // A refused upload never attaches; the accepted photo does.
  await page.getByLabel(t("media.file")).setInputFiles(pdfFile);
  await expect(page.getByText(t("media.unsupported"))).toBeVisible();
  await page.getByLabel(t("media.file")).setInputFiles(photoFile);
  await page.locator("#photo").getByRole("button", { name: t("photo.upload") }).click();
  await expect(page.getByText(t("photo.saved"))).toBeVisible();

  await page.goto(`${origin}/en/provider/locations`);
  const location = page.getByRole("region", { name: t("providerLocations.add") });
  await location.getByLabel(t("providerLocations.label")).fill("Journey Clinic");
  await location.getByLabel(t("providerLocations.address")).fill("1 Journey Street");
  await location.getByLabel(t("providerLocations.country")).selectOption("MK");
  await location.getByLabel(t("providerLocations.city")).selectOption(skopje);
  await location.getByRole("button", { name: t("providerLocations.create") }).click();
  await expect(page.getByText(t("records.saved"))).toBeVisible();

  await page.goto(`${origin}/en/provider/services`);
  const service = page.getByRole("region", { name: t("providerServices.add") });
  await service.getByLabel(t("providerServices.name")).fill("Journey consultation");
  await service.getByLabel("Journey Clinic, 1 Journey Street").check();
  await service.getByRole("button", { name: t("providerServices.create") }).click();
  await expect(page.getByText(t("records.saved"))).toBeVisible();

  await page.goto(`${origin}/en/provider/credentials`);
  const card = await createCredential(page, "Journey licence");
  await card.getByLabel(`${t("media.file")}: Journey licence`).setInputFiles(evidenceFile);
  await card.getByRole("button", { name: t("evidence.add") }).click();
  await expect(page.getByText(t("evidence.saved"))).toBeVisible();
  const evidence = (await card.getByRole("img", { name: `${t("evidence.image")} 1` }).getAttribute("src"))!;
  await card.getByRole("button", { name: `${t("credentials.submit")}: Journey licence` }).click();
  await expect(page.getByText(t("credentials.submitted"))).toBeVisible();
  // A draft that is never submitted must never appear publicly.
  await createCredential(page, "Journey unsubmitted diploma");
  await expect(page.getByRole("article", { name: "Journey unsubmitted diploma" })).toBeVisible();
  return { evidence };
}
async function administrator(browser: Browser, request: APIRequestContext) {
  const admin = await session(browser);
  await signIn(admin.page);
  await control(request, "admin/grant");
  return admin;
}
async function decide(page: Page, action: "approve" | "suspend" | "reinstate") {
  await page.getByRole("link", { name: t(`review.action.${action}`), exact: true }).click();
  await page.locator("section[aria-labelledby=decision]").getByRole("button", { name: t(`review.action.${action}`) }).click();
}
async function openDoctor(page: Page, state = "PENDING") {
  await page.goto(`${origin}/en/admin/doctors?state=${state}`);
  await page.getByRole("link", { name: new RegExp(`^${t("review.open")}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: t("review.doctor.heading") })).toBeVisible();
}
async function approveAll(page: Page) {
  await page.goto(`${origin}/en/admin/credentials`);
  await page.getByRole("link", { name: new RegExp(`^${t("review.open")}\\s*: Journey licence`) }).click();
  const image = page.getByRole("img", { name: `${t("evidence.image")} 1` });
  expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1);
  await decide(page, "approve");
  await expect(page.getByText(t("review.outcome.approved"))).toBeVisible();
  await openDoctor(page);
  await decide(page, "approve");
  await expect(page.getByText(t("review.outcome.approved"))).toBeVisible();
}
async function publication(page: Page, action: "publish" | "unpublish") {
  await page.goto(`${origin}/en/provider/publication`);
  await page.getByRole("link", { name: t(`publication.${action}`) }).click();
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: t(`publication.${action}`) }).click();
}
const profilePath = (slug: string, locale = "en") => `${origin}/${locale}/doctors/${slug}`;
const photoLoaded = (page: Page) => page.locator("main img").evaluate(image => (image as HTMLImageElement).complete &&
  (image as HTMLImageElement).naturalWidth > 0);
async function slugOf(page: Page) {
  await page.goto(`${origin}/en/provider/profile`);
  return (await page.locator("dd code").textContent())!;
}
// Nothing private, owner-only or unapproved is ever part of a public page.
function expectPublicOnly(html: string, evidence: string) {
  expect(html).not.toMatch(privateValues);
  expect(html).not.toContain(evidence);
  expect(html).not.toContain(evidence.split("/")[4]);
  expect(html).not.toContain("Journey unsubmitted diploma");
  expect(html).not.toContain("/api/v1/media/");
}
async function listed(page: Page) {
  await page.goto(`${origin}/en/doctors`);
  return page.getByRole("main").getByRole("link", { name: doctorName }).count();
}

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

test("a doctor goes from sign-in to an anonymous, JavaScript-free public profile and back out on revocation", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const { evidence } = await prepareDoctor(page);
  const slug = await slugOf(page);
  await page.goto(`${origin}/en/provider/publication`);
  await expect(page.getByText(t("publication.needsApproval"))).toBeVisible();
  await expect(page.getByRole("link", { name: t("publication.publish") })).toHaveCount(0);

  const admin = await administrator(browser, request);
  const visitor = await session(browser, { javaScriptEnabled: false });
  try {
    // Before approval and publication the doctor is not public.
    expect((await visitor.page.goto(profilePath(slug)))?.status()).toBe(404);
    expect(await listed(visitor.page)).toBe(0);

    await approveAll(admin.page);
    await page.goto(`${origin}/en/provider/publication`);
    await expect(page.getByText(t("publication.complete"))).toBeVisible();
    await publication(page, "publish");
    await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();

    for (const locale of localeCodes) {
      const response = await visitor.page.goto(profilePath(slug, locale));
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toContain("no-store");
      await expect(visitor.page.locator("html")).toHaveAttribute("lang", locale);
      await expect(visitor.page.getByRole("heading", { level: 1 })).toHaveText(doctorName);
      await expect(visitor.page.getByText("Synthetic journey biography")).toBeVisible();
      await expect(visitor.page.getByText(`${translator(locale)("credential.type.license")}: Journey licence`)).toBeVisible();
      await expect(visitor.page.getByText("Journey consultation")).toBeVisible();
      await expect(visitor.page.getByText("1 Journey Street")).toBeVisible();
      expect(await photoLoaded(visitor.page)).toBe(true);
      await expect(visitor.page.locator("main img")).toHaveAttribute("src", /^\/api\/v1\/public\/media\/[0-9a-f-]{36}\/content$/);
      await expect(visitor.page.locator('link[rel="canonical"]')).toHaveAttribute("href", profilePath(slug, locale));
      await expect(visitor.page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      expectPublicOnly(await visitor.page.content(), evidence);
    }
    const photo = (await visitor.page.locator("main img").getAttribute("src"))!;
    // Evidence is never delivered through the public media route.
    expect((await visitor.context.request.get(fixture + `/api/v1/public/media/${evidence.split("/")[4]}/content`)).status()).toBe(404);

    await visitor.page.goto(`${origin}/en/doctors`);
    await visitor.page.getByLabel(t("directory.specialty")).selectOption({ label: "Cardiology" });
    await visitor.page.getByLabel(t("directory.city")).selectOption({ label: "Skopje" });
    await visitor.page.getByRole("button", { name: t("directory.apply") }).click();
    await expect(visitor.page.getByRole("main").getByRole("link", { name: doctorName })).toBeVisible();
    expectPublicOnly(await visitor.page.content(), evidence);
    await visitor.page.getByLabel(t("directory.specialty")).selectOption({ label: "Dermatology" });
    await visitor.page.getByRole("button", { name: t("directory.apply") }).click();
    await expect(visitor.page.getByText(t("directory.noMatch"))).toBeVisible();

    // Suspension revokes the profile, photo and directory entry on the next request, despite earlier reads.
    expect((await visitor.context.request.get(fixture + photo)).status()).toBe(200);
    await openDoctor(admin.page, "APPROVED");
    await decide(admin.page, "suspend");
    await expect(admin.page.getByText(t("review.outcome.suspended"))).toBeVisible();
    expect((await visitor.page.goto(profilePath(slug)))?.status()).toBe(404);
    expect(await visitor.page.content()).not.toContain(doctorName);
    expect((await visitor.context.request.get(fixture + photo)).status()).toBe(404);
    expect(await listed(visitor.page)).toBe(0);

    // Reinstatement never republishes; only the owner's explicit publication does.
    await decide(admin.page, "reinstate");
    await expect(admin.page.getByText(t("review.outcome.reinstated"))).toBeVisible();
    expect((await visitor.page.goto(profilePath(slug)))?.status()).toBe(404);
    await publication(page, "publish");
    await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();
    expect((await visitor.page.goto(profilePath(slug)))?.status()).toBe(200);
    expect(await listed(visitor.page)).toBe(1);

    await publication(page, "unpublish");
    await expect(page.getByText(t("publication.outcome.unpublished"))).toBeVisible();
    expect((await visitor.page.goto(profilePath(slug)))?.status()).toBe(404);
    expect((await visitor.context.request.get(fixture + photo)).status()).toBe(404);
    expect(await listed(visitor.page)).toBe(0);
  } finally {
    await admin.context.close();
    await visitor.context.close();
  }
});

test("other accounts, expired sessions, CSRF failures, stale publication and outages never leak or fake success", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const { evidence } = await prepareDoctor(page);
  const slug = await slugOf(page);

  // Another doctor sees only their own empty workspace and no administrator data.
  const other = await session(browser);
  try {
    await onboard(other.page);
    await expect(other.page.getByLabel(t("profileEditor.displayName"))).toHaveValue("");
    await other.page.goto(`${origin}/en/provider/credentials`);
    await expect(other.page.getByText("Journey licence")).toHaveCount(0);
    expect((await other.context.request.get(fixture + evidence)).status()).toBe(404);
    for (const path of ["/en/admin/doctors", "/en/admin/credentials"]) {
      await other.page.goto(origin + path);
      await expect(other.page.getByText(t("admin.denied"))).toBeVisible();
    }
    expect(await other.page.content()).not.toContain(doctorName);
  } finally { await other.context.close(); }

  const admin = await administrator(browser, request);
  try { await approveAll(admin.page); } finally { await admin.context.close(); }

  // A CSRF refusal and a stale version are both refused; neither is shown as published.
  await page.goto(`${origin}/en/provider/publication`);
  await page.getByRole("link", { name: t("publication.publish") }).click();
  await mode(request, "bad-csrf");
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: t("publication.publish") }).click();
  await expect(page.getByText(t("account.forbidden")).first()).toBeVisible();
  await mode(request, "up");
  await page.goto(`${origin}/en/provider/publication`);
  await page.getByRole("link", { name: t("publication.publish") }).click();
  await control(request, "profile/bump");
  await page.locator("section[aria-labelledby=publication-confirm]").getByRole("button", { name: t("publication.publish") }).click();
  await expect(page.getByText(t("publication.outcome.conflict"))).toBeVisible();
  await expect(page.getByText(t("profileEditor.publication.draft"), { exact: true })).toBeVisible();
  expect((await page.request.get(profilePath(slug))).status()).toBe(404);

  // An expired session shows the expired state and nothing from the workspace.
  await mode(request, "expired");
  for (const path of ["/en/provider", "/en/provider/publication", "/en/provider/credentials"]) {
    const response = await page.goto(origin + path);
    await expect(page.getByText(t("account.expired")).first()).toBeVisible();
    const html = await response!.text();
    expect(html).not.toMatch(privateValues);
    expect(html).not.toContain("Journey licence");
  }
  await mode(request, "up");

  // After publication, an API outage is a safe, non-indexed state on public and provider pages alike.
  await publication(page, "publish");
  await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();
  await mode(request, "down");
  const response = await page.goto(profilePath(slug));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(t("publicProfile.unavailable"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await response!.text()).not.toMatch(/Dr\. Journey Synthetic|synthetic-private-error/);
  await page.goto(`${origin}/en/doctors`);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(t("directory.unavailable"));
  await page.goto(`${origin}/en/provider/publication`);
  await expect(page.getByText(t("account.unavailable")).first()).toBeVisible();
  expect(await page.content()).not.toMatch(/synthetic-private-error/);
});

test("the published end state is keyboard accessible, fits 320 px and passes axe", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  await prepareDoctor(page);
  const slug = await slugOf(page);
  const admin = await administrator(browser, request);
  try { await approveAll(admin.page); } finally { await admin.context.close(); }
  await publication(page, "publish");
  await expect(page.getByText(t("publication.outcome.published"))).toBeVisible();

  const visitor = await session(browser, { viewport: { width: 320, height: 640 } });
  try {
    for (const path of [profilePath(slug), `${origin}/en/doctors`]) {
      await visitor.page.goto(path);
      await visitor.page.keyboard.press("Tab");
      await expect(visitor.page.getByRole("link", { name: t("navigation.skipToContent") })).toBeFocused();
      expect(await visitor.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await visitor.page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      expect(await visitor.page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
    }
  } finally { await visitor.context.close(); }
});
