import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { currentContext, onboardWorkspace } from "./organization";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const context = { organizationId: "synthetic-private-org", approvalState: "PENDING", suspended: false };
const onboarding = { organizationId: "synthetic-private-org", approvalState: "PENDING" };
const csrf = (token = "synthetic-csrf") => Response.json({ token, headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("current context", () => {
  test("signed-out SSR never calls the API", async () => {
    expect(await currentContext()).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("uses fixed origin, session-only forwarding and private transport", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(context));
    expect(await currentContext("synthetic-session")).toEqual({ state: "ready", context });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/me");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Array.from(new Headers(init?.headers).entries())).toEqual([["cookie", "platform-session-local=synthetic-session"]]);
  });
  test.each([[404, "notOnboarded"], [401, "expired"], [403, "forbidden"], [500, "unavailable"], [302, "unavailable"]] as const)(
    "maps HTTP %s safely", async (status, state) => {
      fetchMock.mockResolvedValueOnce(problem(status));
      expect(await currentContext("synthetic-session")).toEqual({ state });
    });
  test.each([null, {}, { ...context, organizationId: "" }, { ...context, approvalState: 1 }, { ...context, suspended: "false" }])(
    "rejects malformed context %#", async payload => {
      fetchMock.mockResolvedValueOnce(Response.json(payload));
      expect(await currentContext("synthetic-session")).toEqual({ state: "unavailable" });
    });
  test("read-only SSR refuses session changes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(context, { headers: { "Set-Cookie": "platform-session-local=rotated; Path=/; HttpOnly; SameSite=Lax" } }));
    expect(await currentContext("synthetic-session")).toEqual({ state: "unavailable" });
  });
});

describe("onboarding", () => {
  test.each([null, "", "null", "https://evil.test", "http://localhost:3000.evil.test"])("rejects origin %s before any API call", async value => {
    expect(await onboardWorkspace(value, "synthetic-session", vi.fn())).toBe("forbidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("requires a session", async () => {
    expect(await onboardWorkspace(origin, undefined, vi.fn())).toBe("signedOut");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("bootstraps CSRF and posts without any caller-supplied tenant data", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json(onboarding));
    expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe("ready");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/api/auth/csrf");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:8080/api/v1/onboarding");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(init?.body).toBeUndefined();
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      cookie: "platform-session-local=synthetic-session", "x-csrf-token": "fresh-token" });
  });
  test.each([[401, "expired"], [403, "forbidden"]] as const)("authoritative %s is not retried", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe(state);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("ambiguous failure recovers from the API's current context", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockRejectedValueOnce(new Error("synthetic-private-error"))
      .mockResolvedValueOnce(Response.json(context));
    expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe("ready");
    expect(fetchMock.mock.calls[2][0]).toBe("http://localhost:8080/api/v1/me");
  });
  test.each([[problem(404), "unavailable"], [problem(500), "unavailable"], [problem(401), "expired"]] as const)(
    "unconfirmed failure is never success %#", async (refresh, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(503)).mockResolvedValueOnce(refresh);
      expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe(state);
    });
  test("malformed success is confirmed through current context", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(problem(404));
    expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe("unavailable");
  });
  test("invalid CSRF never reaches onboarding", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ token: "", headerName: "X-CSRF-TOKEN" }));
    expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test("parallel users never share session or CSRF state", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const headers = new Headers(init?.headers);
      const session = headers.get("cookie")!.split("=")[1];
      if (String(url).endsWith("/csrf")) return csrf(`token-${session}`);
      expect(headers.get("X-CSRF-TOKEN")).toBe(`token-${session}`);
      return Response.json({ ...onboarding, organizationId: `org-${session}` });
    });
    expect(await Promise.all(["user-a", "user-b"].map(session => onboardWorkspace(origin, session, vi.fn()))))
      .toEqual(["ready", "ready"]);
  });
  test("failures are safe and never logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockRejectedValue(new Error("synthetic-private-error"));
      expect(await currentContext("synthetic-session")).toEqual({ state: "unavailable" });
      expect(await onboardWorkspace(origin, "synthetic-session", vi.fn())).toBe("unavailable");
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
