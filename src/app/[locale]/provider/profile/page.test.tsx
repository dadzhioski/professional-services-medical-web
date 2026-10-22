import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
// SiteHeader is async and covered by its own tests; the stub proves each page renders it.
vi.mock("@/components/site-header", () => ({ SiteHeader: ({ current }: { current?: string }) => <header data-current={current ?? "none"} /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-profile/actions", () => ({ createProfileDraft: vi.fn(), saveProfileDraft: vi.fn(), saveProfileSpecialty: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readProfile: vi.fn() }));
vi.mock("@/lib/api/medical", () => ({ readMedical: vi.fn() }));
vi.mock("@/lib/api/reference", () => ({ listSpecialties: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { readMedical } from "@/lib/api/medical";
import { listSpecialties } from "@/lib/api/reference";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const ready = { state: "ready", context: { organizationId: "synthetic-private-org", approvalState: "PENDING", suspended: false } } as const;
const profile = { profileId: "synthetic-private-profile", organizationId: "synthetic-private-org", slug: "dr-0000abcd",
  displayName: "Synthetic Doctor", biography: '<script>alert("synthetic")</script>', publicationState: "DRAFT", version: 2 };
const render = async (locale = "en", notice?: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ notice }) }));
const privateValues = /synthetic-private|synthetic-session|localhost:8080|@/;
const specialties = [{ id: "spec-1", code: "cardiology", labels: { mk: "Кардиологија", en: "Cardiology", bg: "Кардиология" } },
  { id: "spec-2", code: "dermatology", labels: { en: "Dermatology" } }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readMedical).mockResolvedValue({ state: "missing" });
  vi.mocked(listSpecialties).mockResolvedValue({ state: "ready", records: specialties });
});
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
test("renders the site header before main", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  expect((await render()).startsWith('<header data-current="none"></header><main id="main-content"')).toBe(true);
});
for (const locale of localeCodes) {
  test(`${locale} renders the specialty choice by stable ID with contract labels`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue(ready);
    vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
    vi.mocked(readMedical).mockResolvedValue({ state: "ready", medical: { specialtyId: "spec-1", licenseNumber: "SYN-PRIVATE-LICENCE", version: 2 } });
    const html = await render(locale);
    expect(html).toContain(t("specialtyEditor.heading"));
    expect(html).toMatch(/<option value="spec-1" selected="">/);
    expect(html).toContain(`>${({ mk: "Кардиологија", en: "Cardiology", bg: "Кардиология", sq: "cardiology" })[locale]}</option>`);
    if (locale === "sq") expect(html).not.toContain("Cardiology");
    expect(html).not.toContain("SYN-PRIVATE-LICENCE");
    expect(html).toContain('name="version" value="2"');
  });
}
test("a retired specialty stays selected and is not silently replaced", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
  vi.mocked(readMedical).mockResolvedValue({ state: "ready", medical: { specialtyId: "spec-retired", version: 2 } });
  const html = await render();
  expect(html).toContain(`<option value="spec-retired" selected="">${translator("en")("specialtyEditor.retired")}</option>`);
});
test("a missing medical extension offers the choice without a version", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue(ready);
  vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
  const html = await render();
  const section = html.slice(html.indexOf('aria-labelledby="specialty-heading"'));
  const form = section.slice(0, section.indexOf("</form>"));
  expect(form).toContain('name="specialtyId"');
  expect(form).not.toContain('name="version"');
});
test.each([[{ state: "unavailable" as const }, { state: "ready" as const, records: [] }], [{ state: "missing" as const }, { state: "unavailable" as const }]])(
  "specialty failures hide the editor with a safe notice %#", async (medical, list) => {
    vi.mocked(currentAccount).mockResolvedValue(authenticated);
    vi.mocked(currentContext).mockResolvedValue(ready);
    vi.mocked(readProfile).mockResolvedValue({ state: "ready", profile });
    vi.mocked(readMedical).mockResolvedValue(medical);
    vi.mocked(listSpecialties).mockResolvedValue(list);
    const html = await render();
    expect(html).not.toContain('name="specialtyId"');
    expect(html).toContain(translator("en")("account.unavailable"));
  });
