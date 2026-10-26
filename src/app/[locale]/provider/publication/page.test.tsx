import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("@/features/provider-publication/actions", () => ({ changePublicationAction: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async (locale: string) => `/api/auth/login?returnTo=%2F${locale}%2Fprovider` }));
vi.mock("@/lib/api/organization", () => ({ currentContext: vi.fn() }));
vi.mock("@/lib/api/profile", () => ({ readPublication: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readPublication, type Publication } from "@/lib/api/profile";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const context = { organizationId: "synthetic-private-org", approvalState: "APPROVED", approvalRevision: 2, suspended: false };
const ready: Publication = { approved: true, suspended: false, missing: [], publicationState: "DRAFT", version: 5 };
const render = async (query: { outcome?: string; confirm?: string } = {}, locale = "en") =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));
const showing = (publication: Partial<Publication> = {}, workspace: Partial<typeof context> = {}) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "ready", context: { ...context, ...workspace } });
  vi.mocked(readPublication).mockResolvedValue({ state: "ready", publication: { ...ready, ...publication } });
};
const t = translator("en");

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} offers publication only as a confirmed step when the API reports it eligible`, async () => {
    const tl = translator(locale);
    showing();
    const html = await render({}, locale);
    expect(html).toContain(tl("publication.heading"));
    expect(html).toContain(tl("publication.complete"));
    expect(html).toContain(`href="/${locale}/provider/publication?confirm=publish#publication-confirm"`);
    expect(html).not.toContain("<form");
    expect(html).toContain(`aria-current="page"`);
    expect(html).not.toMatch(/synthetic-private|localhost:8080/);
    expect(await generateMetadata({ params: Promise.resolve({ locale }) }))
      .toEqual({ title: tl("publication.heading"), robots: { index: false, follow: false } });
  });
}
test("confirming publication sends the version the owner saw", async () => {
  showing();
  const html = await render({ confirm: "publish" });
  expect(html).toContain('<input type="hidden" name="version" value="5"/>');
  expect(html).toContain(t("publication.confirm.publishNote"));
});
test("missing parts link to where they are corrected, and unknown parts are still shown", async () => {
  // A part added to the contract later is still shown as missing.
  showing({ missing: ["SERVICE", "APPROVED_CREDENTIAL", "FUTURE_PART" as Publication["missing"][number]] });
  const html = await render({ confirm: "publish" });
  expect(html).toContain(`<a class="inline-block py-2 font-semibold text-blue-800 underline underline-offset-4" href="/en/provider/services">${t("publication.missing.service")}</a>`);
  expect(html).toContain('href="/en/provider/credentials"');
  expect(html).toContain(t("publication.missing.unknown"));
  expect(html).not.toContain("confirm=publish");
  expect(html).not.toContain("<form");
});
test.each([["not approved", { approved: false }, {}, "publication.needsApproval"],
  ["suspended", { suspended: true }, { suspended: true }, "publication.suspended"]] as const)(
  "a %s doctor cannot publish and is told why", async (_name, publication, workspace, key) => {
    showing(publication, workspace);
    const html = await render({ confirm: "publish" });
    expect(html).toContain(t(key));
    expect(html).not.toContain("confirm=publish");
    expect(html).not.toContain("<form");
  });
test("a published profile offers explicit, confirmed unpublishing", async () => {
  showing({ publicationState: "PUBLISHED", version: 9 });
  expect(await render()).toContain("?confirm=unpublish#publication-confirm");
  const html = await render({ confirm: "unpublish" });
  expect(html).toContain('<input type="hidden" name="version" value="9"/>');
  expect(html).toContain(t("publication.confirm.unpublishNote"));
  expect(html).not.toContain("confirm=publish#");
});
test("an unpublished profile after a completeness loss needs an explicit republish", async () => {
  showing({ publicationState: "UNPUBLISHED", missing: ["PRACTICE_LOCATION"] });
  const html = await render();
  expect(html).toContain(t("profileEditor.publication.unpublished"));
  expect(html).toContain(t("publication.republishNote"));
  expect(html).toContain(t("publication.missing.location"));
  expect(html).not.toContain("confirm=");
});
test.each([["published", "status", "publication.outcome.published"], ["incomplete", "alert", "publication.outcome.incomplete"],
  ["conflict", "alert", "publication.outcome.conflict"]] as const)("outcome %s is announced as %s", async (outcome, role, key) => {
  showing();
  expect(await render({ outcome })).toMatch(new RegExp(`role="${role}"[^>]*>${t(key)}`));
});
test("unknown outcomes are ignored", async () => {
  showing();
  expect(await render({ outcome: "raw-private-error" })).not.toContain("raw-private-error");
});
test("no profile links to the profile editor", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "ready", context });
  vi.mocked(readPublication).mockResolvedValue({ state: "missing" });
  const html = await render();
  expect(html).toContain(t("publication.noProfile"));
  expect(html).toContain('href="/en/provider/profile"');
});
test("no workspace links to onboarding without reading publication", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "notOnboarded" });
  expect(await render()).toContain('href="/en/provider/onboarding"');
  expect(readPublication).not.toHaveBeenCalled();
});
test.each<IdentityState>(["expired", "forbidden", "unavailable"])("publication %s shows a safe notice without controls", async state => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(currentContext).mockResolvedValue({ state: "ready", context });
  vi.mocked(readPublication).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(t(`account.${state}`));
  expect(html).not.toContain("confirm=");
});
test.each<IdentityState>(["signedOut", "expired"])("unauthenticated %s gets login navigation only", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain("/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(readPublication).not.toHaveBeenCalled();
});
