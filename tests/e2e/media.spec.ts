import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { translator, type Locale } from "../../src/lib/i18n";

const fixture = "http://127.0.0.1:4311";
const origin = "http://127.0.0.1:4310";
const require = createRequire(resolve("package.json"));
const privateValues = /synthetic-session|synthetic-csrf|synthetic-private|synthetic-account|127\.0\.0\.1:4311/;
const t = translator("en");

// Synthetic images only: a 1x1 PNG, a minimal JPEG frame, and invalid content.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);
const file = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });
const pngFile = file("photo.png", "image/png", png);
const jpegFile = file("photo.jpg", "image/jpeg", jpeg);
const corruptFile = file("broken.png", "image/png", png.subarray(0, 24));
const pdfFile = file("record.pdf", "application/pdf", Buffer.from("%PDF-1.7 synthetic"));
const oversizedFile = file("huge.png", "image/png", Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]));

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

// Signs in, creates the workspace and an empty draft, and opens the profile editor.
async function openDraft(page: Page, locale: Locale = "en") {
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
}
async function uploadPhoto(page: Page, image: ReturnType<typeof file>, locale: Locale = "en") {
  const tr = translator(locale);
  await page.getByLabel(tr("media.file")).setInputFiles(image);
  await page.locator("#photo").getByRole("button", { name: new RegExp(`^(${tr("photo.upload")}|${tr("photo.replace")})$`) }).click();
}
const photo = (page: Page) => page.getByRole("img", { name: t("photo.current") });
const sourceOf = async (page: Page, image = photo(page)) => (await image.getAttribute("src"))!;
// Owner delivery goes through the same-origin /api/* route; the request context reaches it like the edge does.
const deliver = (request: APIRequestContext, src: string) => request.get(fixture + src);

async function openCredentials(page: Page, request: APIRequestContext) {
  await openDraft(page);
  await control(request, "credentials/seed");
  await page.goto(`${origin}/en/provider/credentials`);
  await expect(page.getByRole("heading", { name: "Synthetic licence" })).toBeVisible();
}
const evidenceInput = (page: Page) => page.getByLabel(`${t("media.file")}: Synthetic licence`);
async function addEvidence(page: Page, image = pngFile) {
  await evidenceInput(page).setInputFiles(image);
  await page.getByRole("button", { name: t("evidence.add") }).click();
}
const evidenceImages = (page: Page) => page.getByRole("img", { name: new RegExp(`^${t("evidence.image")} \\d$`) });

test.beforeEach(async ({ request, context }) => {
  await mode(request, "reset");
  await navigation(context);
});
test.afterEach(async ({ request }) => { await mode(request, "reset"); });

for (const locale of ["mk", "en"] as const) {
  test(`${locale}: upload, replace and remove a profile photo without JavaScript`, async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await navigation(context);
    const page = await context.newPage();
    const tr = translator(locale);
    try {
      await openDraft(page, locale);
      await expect(page.getByText(tr("photo.none"))).toBeVisible();
      await uploadPhoto(page, pngFile, locale);
      await expect(page.getByText(tr("photo.saved"))).toBeVisible();
      const image = page.getByRole("img", { name: tr("photo.current") });
      await expect(image).toBeVisible();
      const first = (await image.getAttribute("src"))!;
      expect(first).toMatch(/^\/api\/v1\/media\/[0-9a-f-]{36}\/content$/);
      const delivered = await deliver(context.request, first);
      expect(delivered.status()).toBe(200);
      expect(delivered.headers()["cache-control"]).toBe("no-store");
      expect(delivered.headers()["content-type"]).toBe("image/png");

      await uploadPhoto(page, jpegFile, locale);
      await expect(page.getByText(tr("photo.saved"))).toBeVisible();
      const second = (await image.getAttribute("src"))!;
      expect(second).not.toBe(first);
      // The replaced photo is released; once the API cleans it up, a fresh request is denied despite the earlier read.
      await control(request, "media/cleanup");
      expect((await deliver(context.request, first)).status()).toBe(404);
      expect((await deliver(context.request, second)).status()).toBe(200);

      await page.locator("#photo").getByRole("button", { name: tr("photo.remove") }).click();
      await expect(page.getByText(tr("photo.removed"))).toBeVisible();
      await expect(page.locator("img")).toHaveCount(0);
      await control(request, "media/cleanup");
      expect((await deliver(context.request, second)).status()).toBe(404);
      const response = await page.goto(`${origin}/${locale}/provider/profile`);
      expect(response!.headers()["cache-control"]).toContain("no-store");
      expect(await response!.text()).not.toMatch(privateValues);
    } finally { await context.close(); }
  });
}

test("unsuitable files are blocked in the browser and rejected uploads never attach", async ({ page, browser, request }) => {
  await openDraft(page);
  await page.getByLabel(t("media.file")).setInputFiles(pdfFile);
  await expect(page.getByText(t("media.unsupported"))).toBeVisible();
  await page.locator("#photo").getByRole("button", { name: t("photo.upload") }).click();
  await expect(page).toHaveURL(`${origin}/en/provider/profile`);
  await page.getByLabel(t("media.file")).setInputFiles(oversizedFile);
  await expect(page.getByText(t("media.tooLarge"))).toBeVisible();

  // Without JavaScript the server and API report the same problems.
  const context = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
  await navigation(context);
  try {
    const noScript = await context.newPage();
    await noScript.goto(`${origin}/en/provider/profile`);
    for (const [image, key] of [[oversizedFile, "media.tooLarge"], [pdfFile, "media.unsupported"], [corruptFile, "media.invalid"]] as const) {
      await uploadPhoto(noScript, image);
      await expect(noScript.getByRole("alert").filter({ hasText: t(key) })).toBeVisible();
    }
    await mode(request, "media-busy");
    await uploadPhoto(noScript, pngFile);
    await expect(noScript.getByText(t("media.busy"))).toBeVisible();
    await mode(request, "upload-reset");
    await uploadPhoto(noScript, pngFile);
    await expect(noScript.getByText(t("account.unavailable"))).toBeVisible();
    await mode(request, "media-reject");
    await uploadPhoto(noScript, pngFile);
    await expect(noScript.getByText(t("media.invalid"))).toBeVisible();
    await mode(request, "up");
    await noScript.reload();
    await expect(noScript.getByText(t("photo.none"))).toBeVisible();
    expect(await noScript.content()).not.toMatch(/synthetic-private-error/);
  } finally { await context.close(); }
});

test("a stale photo change is a conflict, and the editor follows the new version", async ({ page, request }) => {
  await openDraft(page);
  await control(request, "profile/bump");
  await uploadPhoto(page, pngFile);
  await expect(page.getByText(t("photo.conflict"))).toBeVisible();
  await expect(photo(page)).toHaveCount(0);
  await uploadPhoto(page, pngFile);
  await expect(page.getByText(t("photo.saved"))).toBeVisible();
  // The photo bumped the profile version; saving text afterwards must not conflict.
  await page.getByLabel(t("profileEditor.displayName")).fill("Dr. Synthetic Photo");
  await page.getByRole("button", { name: t("profileEditor.save"), exact: true }).click();
  await expect(page.getByText(t("profileEditor.saved"))).toBeVisible();
  await expect(page.getByRole("region", { name: t("profileEditor.previewHeading") }).locator("img")).toHaveAttribute("src", await sourceOf(page));
});

test("photo and evidence changes require the site Origin", async ({ browser, request }) => {
  // Without JavaScript the forms carry the hidden action fields a cross-site page could replay.
  const context = await browser.newContext({ javaScriptEnabled: false });
  await navigation(context);
  const hidden = (page: Page, form: string) => page.locator(form).locator("input[type=hidden]").evaluateAll(inputs =>
    Object.fromEntries(inputs.map(input => [(input as HTMLInputElement).name, (input as HTMLInputElement).value])));
  const image = { name: "photo.png", mimeType: "image/png", buffer: png };
  try {
    const page = await context.newPage();
    await openDraft(page);
    const photoFields = await hidden(page, "#photo form >> nth=0");
    const crossSite = await context.request.post(`${origin}/en/provider/profile`, { multipart: { ...photoFields, photo: image } });
    expect(crossSite.url()).toContain("photo=forbidden");
    await page.reload();
    await expect(page.getByText(t("photo.none"))).toBeVisible();

    await control(request, "credentials/seed");
    await page.goto(`${origin}/en/provider/credentials`);
    const evidenceFields = await hidden(page, "article form >> nth=0");
    const forged = await context.request.post(`${origin}/en/provider/credentials`, { multipart: { ...evidenceFields, evidence: image } });
    expect(forged.url()).toContain("evidence=forbidden");
    await page.reload();
    await expect(page.getByText(t("evidence.noEvidence"))).toBeVisible();
  } finally { await context.close(); }
});

test("evidence is private, limited to the owner and removed on request", async ({ page, request, browser, playwright }) => {
  await openCredentials(page, request);
  await expect(page.getByText(t("evidence.noEvidence"))).toBeVisible();
  await expect(page.getByText(t("credential.state.approved"), { exact: true })).toBeVisible();
  await addEvidence(page);
  await expect(page.getByText(t("evidence.saved"))).toBeVisible();
  // Changing evidence starts a new draft revision.
  await expect(page.getByText(t("credential.state.draft"), { exact: true })).toBeVisible();
  const src = await sourceOf(page, evidenceImages(page).first());
  const owner = await deliver(page.context().request, src);
  expect(owner.status()).toBe(200);
  expect(owner.headers()["cache-control"]).toBe("no-store");

  const anonymous = await playwright.request.newContext();
  try {
    expect((await deliver(anonymous, src)).status()).toBe(401);
    for (const path of ["/en/provider/credentials", "/mk/provider/credentials"]) {
      expect(await (await anonymous.get(`${origin}${path}`)).text()).not.toContain(src);
    }
  } finally { await anonymous.dispose(); }

  const other = await browser.newContext();
  await navigation(other);
  try {
    const otherPage = await other.newPage();
    await openDraft(otherPage);
    expect((await deliver(other.request, src)).status()).toBe(404);
    await otherPage.goto(`${origin}/en/provider/credentials`);
    await expect(otherPage.getByText(t("evidence.none"))).toBeVisible();
  } finally { await other.close(); }

  const { mediaId } = await (await control(request, "media/foreign")).json();
  expect((await deliver(page.context().request, `/api/v1/media/${mediaId}/content`)).status()).toBe(404);

  await page.getByRole("button", { name: `${t("evidence.remove")}: ${t("evidence.image")} 1, Synthetic licence` }).click();
  await expect(page.getByText(t("evidence.removed"))).toBeVisible();
  await expect(evidenceImages(page)).toHaveCount(0);
  // Released evidence is deleted at once rather than waiting for cleanup.
  expect((await deliver(page.context().request, src)).status()).toBe(404);
});

test("evidence respects the image limit, stale credentials and rejected uploads", async ({ page, request }) => {
  await openCredentials(page, request);
  await addEvidence(page, corruptFile);
  await expect(page.getByText(t("media.invalid"))).toBeVisible();
  await expect(evidenceImages(page)).toHaveCount(0);
  for (let count = 1; count <= 5; count++) {
    await addEvidence(page, count % 2 ? pngFile : jpegFile);
    await expect(evidenceImages(page)).toHaveCount(count);
  }
  await expect(page.getByText(t("evidence.full"))).toBeVisible();
  await expect(evidenceInput(page)).toHaveCount(0);
  await control(request, "credentials/bump");
  await page.getByRole("button", { name: `${t("evidence.remove")}: ${t("evidence.image")} 5, Synthetic licence` }).click();
  await expect(page.getByText(t("evidence.conflict"))).toBeVisible();
  await expect(evidenceImages(page)).toHaveCount(5);
  await mode(request, "media-reject");
  await page.getByRole("button", { name: `${t("evidence.remove")}: ${t("evidence.image")} 5, Synthetic licence` }).click();
  await expect(page.getByText(t("evidence.removed"))).toBeVisible();
  await addEvidence(page);
  await expect(page.getByText(t("media.invalid"))).toBeVisible();
  await expect(evidenceImages(page)).toHaveCount(4);
});

test("photo and evidence controls are keyboard accessible and pass axe", async ({ page, request }) => {
  const axe = async () => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations)).toEqual([]);
  };
  await openDraft(page);
  await uploadPhoto(page, pngFile);
  await expect(page.getByText(t("photo.saved"))).toBeVisible();
  await page.getByLabel(t("media.file")).setInputFiles(pdfFile);
  await expect(page.getByText(t("media.unsupported"))).toBeVisible();
  await axe();
  await page.getByLabel(t("media.file")).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#photo").getByRole("button", { name: t("photo.replace") })).toBeFocused();
  await control(request, "credentials/seed");
  await page.goto(`${origin}/en/provider/credentials`);
  await addEvidence(page);
  await expect(page.getByText(t("evidence.saved"))).toBeVisible();
  await axe();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
