import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { IdentityApi } from "@dadzhioski/professional-services-api-client";
import { currentAccount, googleLoginHref, logoutSession } from "./identity";
import { incomingSession, isDeletedSession, sessionChanges, sessionCookieName } from "./session-cookie";

const fetchMock = vi.fn<typeof fetch>();
const account = { accountId: "synthetic-account", emailVerified: true, sessionExpiresAt: "2099-01-01T00:00:00Z" };
const cookie = (value: string, extra = "") => `platform-session-local=${value}; Path=/; HttpOnly; SameSite=Lax${extra}`;
const csrf = (token = "synthetic-csrf", setCookie?: string) => Response.json({ token, headerName: "X-CSRF-TOKEN" },
  { headers: setCookie ? { "Set-Cookie": setCookie } : undefined });
const cleared = () => new Response(null, { status: 204, headers: { "Set-Cookie": cookie("", "; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT") } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("identity boundary", () => {
  test.each(["mk", "en", "bg", "sq"] as const)("uses same-origin generated navigation for %s", async locale => {
    const href = await googleLoginHref(locale);
    expect(href).toBe(`/api/auth/login?returnTo=%2F${locale}%2Fprovider`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("rejects query-derived return destinations", async () => {
    for (const locale of ["//evil.test", "en?returnTo=//evil.test", "en/../../", "xx"]) {
      await expect(googleLoginHref(locale as "en")).rejects.toThrow("Invalid locale");
    }
  });
  test.each(["/api/auth\\login", "/api/auth/login#x", "/api/auth/ login"])("rejects unsafe generated login path %s", async path => {
    const opts = vi.spyOn(IdentityApi.prototype, "beginGoogleLoginRequestOpts")
      .mockResolvedValueOnce({ path, method: "GET", headers: {}, query: {} });
    try { await expect(googleLoginHref("en")).rejects.toThrow("Invalid login navigation"); } finally { opts.mockRestore(); }
  });
  test("signed-out SSR never bootstraps a session", async () => {
    expect(await currentAccount()).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("SSR uses fixed origin, session-only forwarding and private transport", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(account));
    expect((await currentAccount("synthetic-session")).state).toBe("authenticated");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/account");
    expect(init).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Array.from(new Headers(init?.headers).entries())).toEqual([["cookie", "platform-session-local=synthetic-session"]]);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  test.each([[401, "expired"], [403, "forbidden"], [500, "unavailable"], [302, "unavailable"]] as const)("safe HTTP %s", async (status, state) => {
    fetchMock.mockResolvedValueOnce(new Response("synthetic-private-error", { status }));
    expect(await currentAccount("synthetic-session")).toEqual({ state });
  });
  test.each([null, {}, { ...account, emailVerified: "true" }, { ...account, sessionExpiresAt: "bad" }])("rejects malformed account %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await currentAccount("synthetic-session")).toEqual({ state: "unavailable" });
  });
  test("expiry and unverified identity are not authenticated", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...account, sessionExpiresAt: "2000-01-01T00:00:00Z" }))
      .mockResolvedValueOnce(Response.json({ ...account, emailVerified: false }));
    expect((await currentAccount("synthetic-session")).state).toBe("expired");
    expect((await currentAccount("synthetic-session")).state).toBe("forbidden");
  });
  test("SSR refuses unexpected rotation and never mutates cookies", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(account, { headers: { "Set-Cookie": cookie("rotated") } }));
    expect(await currentAccount("synthetic-session")).toEqual({ state: "unavailable" });
  });
  test.each([null, "", "null", "https://evil.test", "http://localhost:3000/", "http://localhost:3000.evil.test"])("rejects origin before bootstrap (%s)", async origin => {
    expect(await logoutSession(origin, "synthetic-session", vi.fn())).toBe("forbidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("logout forwards rotated session with fresh CSRF and propagates deletion", async () => {
    const apply = vi.fn();
    fetchMock.mockResolvedValueOnce(csrf("fresh-token", cookie("rotated-session"))).mockResolvedValueOnce(cleared());
    expect(await logoutSession("http://localhost:3000", "original-session", apply)).toBe("signedOut");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:8080/api/auth/logout");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("cookie")).toBe("platform-session-local=rotated-session");
    expect(new Headers(init?.headers).get("X-CSRF-TOKEN")).toBe("fresh-token");
    expect(apply.mock.calls[0][0]).toMatchObject({ value: "rotated-session", httpOnly: true, sameSite: "lax", secure: false });
    expect(apply.mock.calls[1][0]).toMatchObject({ value: "", maxAge: 0, expires: new Date(0) });
  });
  test("parallel users never share session or CSRF state", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const headers = new Headers(init?.headers);
      const session = headers.get("cookie")!.split("=")[1];
      if (String(url).endsWith("/csrf")) return csrf(`token-${session}`);
      expect(headers.get("X-CSRF-TOKEN")).toBe(`token-${session}`);
      return cleared();
    });
    expect(await Promise.all(["user-a", "user-b"].map(session => logoutSession("http://localhost:3000", session, vi.fn()))))
      .toEqual(["signedOut", "signedOut"]);
  });
  test.each([{ headerName: "X-CSRF-TOKEN" }, { token: "", headerName: "X-CSRF-TOKEN" },
    { token: "synthetic", headerName: "Authorization" }])("does not mutate with invalid CSRF %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await logoutSession("http://localhost:3000", "session", vi.fn())).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test("upstream CSRF rejection stays forbidden; the next attempt fetches a fresh token", async () => {
    fetchMock.mockResolvedValueOnce(csrf("first")).mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(csrf("second")).mockResolvedValueOnce(cleared());
    expect(await logoutSession("http://localhost:3000", "session", vi.fn())).toBe("forbidden");
    expect(await logoutSession("http://localhost:3000", "session", vi.fn())).toBe("signedOut");
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("X-CSRF-TOKEN")).toBe("second");
  });
  test("missing deletion is not reported as successful logout", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await logoutSession("http://localhost:3000", "session", vi.fn())).toBe("unavailable");
  });
  test("network failures are safe and never logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockRejectedValue(new Error("synthetic-private-error"));
      expect(await currentAccount("session")).toEqual({ state: "unavailable" });
      expect(await logoutSession("http://localhost:3000", "session", vi.fn())).toBe("unavailable");
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});

describe("session cookie boundary", () => {
  test("Max-Age takes precedence over Expires for rotation and deletion", () => {
    const rotated = sessionChanges(new Headers({ "Set-Cookie": cookie("rotated", "; Max-Age=120; Expires=Thu, 01 Jan 1970 00:00:00 GMT") }), "platform-session-local")[0];
    expect(isDeletedSession(rotated)).toBe(false);
    expect(isDeletedSession({ ...rotated, maxAge: 0, expires: new Date("2099-01-01") })).toBe(true);
  });
  test("selects documented cookies and rejects duplicate/injected values", () => {
    expect(sessionCookieName("https://example.test")).toBe("__Host-platform-session");
    expect(sessionCookieName("http://localhost:3000")).toBe("platform-session-local");
    const good = { name: "platform-session-local", value: "synthetic" };
    expect(incomingSession([good, { name: "other", value: "private" }], good.name)).toBe("synthetic");
    expect(incomingSession([good, good], good.name)).toBeUndefined();
    expect(incomingSession([{ ...good, value: "bad; other=secret" }], good.name)).toBeUndefined();
  });
  test.each([
    "other=secret; Path=/; HttpOnly; SameSite=Lax", cookie("session", "; Domain=example.test"),
    cookie("session", "; Path=/other"), cookie("session", "; Secure"), cookie("session", "; Max-Age=wat"),
    "platform-session-local=x; Path=/; SameSite=Lax", cookie(""), cookie("session", "; Expires=bad"),
  ])("rejects unsafe Set-Cookie %#", line => {
    expect(() => sessionChanges(new Headers({ "Set-Cookie": line }), "platform-session-local")).toThrow("Invalid session response");
  });
  test("HTTPS requires secure host-only cookie; retains expiry", () => {
    const line = "__Host-platform-session=synthetic; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=120";
    expect(sessionChanges(new Headers({ "Set-Cookie": line }), "__Host-platform-session")[0]).toMatchObject({ secure: true, maxAge: 120 });
    expect(() => sessionChanges(new Headers({ "Set-Cookie": line.replace("; Secure", "") }), "__Host-platform-session")).toThrow();
  });
  test("validates all response cookies before any propagation", async () => {
    const headers = new Headers();
    headers.append("Set-Cookie", cookie("rotated"));
    headers.append("Set-Cookie", "unexpected=private");
    fetchMock.mockResolvedValueOnce(Response.json({ token: "synthetic", headerName: "X-CSRF-TOKEN" }, { headers }));
    const apply = vi.fn();
    expect(await logoutSession("http://localhost:3000", "session", apply)).toBe("unavailable");
    expect(apply).not.toHaveBeenCalled();
  });
});
