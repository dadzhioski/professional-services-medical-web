import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const jar = vi.hoisted(() => ({ cookies: [{ name: "platform-session-local", value: "synthetic-session" }] }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => jar.cookies }) }));
// The header form must target the existing origin- and CSRF-checked logout action.
const bind = vi.hoisted(() => vi.fn(() => "synthetic-bound-logout"));
vi.mock("@/features/provider-account/actions", () => ({ logout: { bind } }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn() }));
import { currentAccount, type IdentityState } from "@/lib/api/identity";
import { localeCodes, translator, type Locale } from "@/lib/i18n";
import { SiteHeader } from "./site-header";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const render = async (locale: Locale = "en", current?: "home" | "directory" | "workspace") =>
  renderToStaticMarkup(await SiteHeader({ locale, current }));
const documentOf = (html: string) => new DOMParser().parseFromString(html, "text/html");

beforeEach(() => {
  vi.clearAllMocks();
  jar.cookies = [{ name: "platform-session-local", value: "synthetic-session" }];
});

for (const locale of localeCodes) {
  test(`${locale} signed-out header links to the directory, then the localized sign-in page`, async () => {
    const t = translator(locale);
    vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
    const page = documentOf(await render(locale));
    const header = page.querySelector("header")!;
    const links = [...header.querySelectorAll("a")].map(link => [link.getAttribute("href"), link.textContent]);
    expect(links).toEqual([[`/${locale}`, t("app.title")], [`/${locale}/doctors`, t("navigation.directory")],
      [`/${locale}/provider`, t("navigation.doctors")]]);
    expect(header.querySelector("nav")?.getAttribute("aria-label")).toBe(t("navigation.primary"));
    expect(header.querySelector("form")).toBeNull();
    expect(header.innerHTML).not.toContain("/api/");
  });
}

test("no session cookie never reaches the identity API with a session", async () => {
  jar.cookies = [];
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  await render();
  expect(currentAccount).toHaveBeenCalledWith(undefined);
});

test("signed-in header shows the workspace and a sign-out form without account data", async () => {
  const t = translator("en");
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  const html = await render("en", "workspace");
  const header = documentOf(html).querySelector("header")!;
  expect(currentAccount).toHaveBeenCalledWith("synthetic-session");
  expect(header.querySelector('nav a[href="/en/doctors"]')?.textContent).toBe(t("navigation.directory"));
  const workspace = header.querySelector('nav a[href="/en/provider"]')!;
  expect(workspace.textContent).toBe(t("navigation.workspace"));
  expect(workspace.getAttribute("aria-current")).toBe("page");
  expect(header.querySelector('form button[type="submit"]')?.textContent).toBe(t("account.logout"));
  expect(bind).toHaveBeenCalledWith(null, "en");
  expect(html).not.toMatch(/synthetic-private-id|synthetic-session|2099|@/);
});

test.each<IdentityState>(["expired", "forbidden", "unavailable"])("%s identity renders the signed-out entry", async state => {
  vi.mocked(currentAccount).mockResolvedValue({ state });
  const html = await render();
  expect(html).toContain(translator("en")("navigation.doctors"));
  expect(html).not.toContain("<form");
});

test("an identity exception renders the signed-out entry without raw errors", async () => {
  vi.mocked(currentAccount).mockRejectedValue(new Error("synthetic-private-error http://localhost:8080"));
  const html = await render();
  expect(html).toContain(translator("en")("navigation.doctors"));
  expect(html).not.toMatch(/synthetic-private-error|localhost:8080|<form/);
});

test("current page is marked only on the matching link", async () => {
  vi.mocked(currentAccount).mockResolvedValue({ state: "signedOut" });
  const home = documentOf(await render("en", "home"));
  expect(home.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/en");
  const directory = documentOf(await render("en", "directory"));
  expect([...directory.querySelectorAll("[aria-current]")].map(link => link.getAttribute("href"))).toEqual(["/en/doctors"]);
  const other = documentOf(await render("en"));
  expect(other.querySelector("[aria-current]")).toBeNull();
});
