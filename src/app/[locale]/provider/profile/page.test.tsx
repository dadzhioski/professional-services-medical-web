import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-profile/actions", () => ({ createProfileDraft: vi.fn(), saveProfileDraft: vi.fn() }));
vi.mock("@/features/provider-profile/photo-actions", () => ({ changeProfilePhoto: vi.fn(), removeProfilePhoto: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false } } as const;
const profile = { profileId: "synthetic-private-profile", organizationId: "synthetic-private-org", slug: "dr-0000abcd",
  displayName: "Synthetic Doctor", biography: '<script>alert("synthetic")</script>', publicationState: "DRAFT", version: 2 };
const render = async (locale = "en", notice?: string, photo?: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ notice, photo }) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080|@/;

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} renders the private editor, read-only slug and noindex metadata server-side`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue(ready);
    vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
    const html = await render(locale);
    expect(html).toContain(t("profileEditor.heading"));
    expect(html).toMatch(new RegExp(`<label[^>]*for="profile-displayName"[^>]*>${t("profileEditor.displayName")}</label>`));
    expect(html).toContain('value="Synthetic Doctor"');
    expect(html).toContain("<code>dr-0000abcd</code>");
    expect(html).not.toMatch(/name="slug"/);
    expect(html).toContain(t("profileEditor.publication.draft"));
    expect(html).toContain(t("profileEditor.contactNote"));
    expect(html).toContain(t("profileEditor.previewHeading"));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html.replace(/https?:\/\/[^"]*|\/api\/auth\/login[^"]*/g, "")).not.toMatch(privateValues);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toMatchObject({ title: t("profileEditor.heading"), robots: { index: false, follow: false } });
  });
}
test("an incomplete draft renders with safe placeholders", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { slug: "dr-0000abcd", version: 0, publicationState: "OTHER" } });
  const html = await render();
  expect(html).toContain(translator("en")("profileEditor.unnamed"));
  expect(html).toContain(translator("en")("profileEditor.publication.unknown"));
});
test("a missing draft offers creation and a failed attempt shows a safe notice", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "missing" });
  const html = await render("en", "unavailable");
  expect(html).toContain(translator("en")("profileEditor.create"));
  expect(html).toContain(translator("en")("account.unavailable"));
  expect(html).not.toMatch(/<input|<textarea/);
});
test("an existing draft ignores stale failure notices", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
  expect(await render("en", "unavailable")).not.toContain(translator("en")("account.unavailable"));
});
test("no workspace links to onboarding without calling the profile API", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  const html = await render();
  expect(html).toContain('href="/en/provider/onboarding"');
  expect(readProfile).not.toHaveBeenCalled();
});
test("a suspended workspace is shown while the API stays authoritative", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "ready", context: { ...ready.context, suspended: true } });
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
  expect(await render()).toContain(translator("en")("workspace.suspended"));
});
test.each<IdentityState>(["expired", "forbidden", "unavailable"])("profile %s hides the editor", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).not.toMatch(/<textarea|profileEditor/);
});
test.each<IdentityState>(["signedOut", "expired", "forbidden", "unavailable"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render("en", "raw-private-error");
  expect(html).toContain(translator("en")(`account.${state}`));
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(html).not.toContain("raw-private-error");
  expect(currentContext).not.toHaveBeenCalled();
  expect(readProfile).not.toHaveBeenCalled();
});
const photoId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
test("a current photo is shown from the same-origin owner route with replace and remove controls", async () => {
  const t = translator("en");
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { ...profile, photoMediaId: photoId } });
  const html = await render("en", undefined, "saved");
  expect(html.match(new RegExp(`<img src="/api/v1/media/${photoId}/content"`, "g"))).toHaveLength(2);
  expect(html).toContain(`alt="${t("photo.current")}"`);
  expect(html).toContain('referrerPolicy="no-referrer"');
  expect(html).not.toMatch(/_next\/image|srcSet|blob:/);
  expect(html).toContain(t("photo.replace"));
  expect(html).toContain(t("photo.remove"));
  expect(html).toMatch(new RegExp(`role="status"[^>]*>${t("photo.saved")}`));
  expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/jpeg,image\/png"[^>]*required/);
  // The editor and both photo forms carry the same profile version.
  expect(html.match(/<input type="hidden" name="version" value="2"/g)).toHaveLength(3);
});
test.each(["https://evil.test/x.png", "../../private", "javascript:alert(1)"])("an unsafe photo ID %s is never rendered", async photoMediaId => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile: { ...profile, photoMediaId } });
  const html = await render();
  expect(html).not.toContain("<img");
  expect(html).not.toContain(photoMediaId);
  expect(html).toContain(translator("en")("photo.none"));
  expect(html).toContain(translator("en")("photo.upload"));
  expect(html).not.toContain(translator("en")("photo.remove"));
});
test("photo failures are announced and unknown outcomes ignored", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
  expect(await render("en", undefined, "tooLarge")).toMatch(new RegExp(`role="alert"[^>]*>${translator("en")("media.tooLarge")}`));
  const html = await render("en", undefined, "<b>raw-private-error</b>");
  expect(html).not.toContain("raw-private-error");
});
