import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createProfile, readProfile, saveProfile } from "./profile";
import { sessionConfiguration } from "./session-transport";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const profile = { profileId: "synthetic-private-profile", organizationId: "synthetic-private-org", slug: "dr-0000abcd",
  displayName: "Synthetic Doctor", biography: "Synthetic biography", publicationState: "DRAFT", version: 3 };
const draft = { displayName: "Synthetic Doctor", biography: "", version: 3 };
const csrf = (token = "synthetic-csrf") => Response.json({ token, headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("read profile", () => {
  test("signed-out SSR never calls the API", async () => {
    expect(await readProfile()).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("uses fixed origin, session-only forwarding and private transport", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(profile));
    expect(await readProfile("synthetic-session")).toEqual({ state: "ready", profile });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/profile");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Array.from(new Headers(init?.headers).entries())).toEqual([["cookie", "platform-session-local=synthetic-session"]]);
  });
  test("accepts an incomplete draft", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ slug: "dr-0000abcd", version: 0 }));
    expect(await readProfile("synthetic-session")).toEqual({ state: "ready", profile: { slug: "dr-0000abcd", version: 0 } });
  });
  test.each([[404, "missing"], [401, "expired"], [403, "forbidden"], [500, "unavailable"], [302, "unavailable"]] as const)(
    "maps HTTP %s safely", async (status, state) => {
      fetchMock.mockResolvedValueOnce(problem(status));
      expect(await readProfile("synthetic-session")).toEqual({ state });
    });
  test.each([null, {}, { ...profile, slug: "" }, { ...profile, version: "3" }, { ...profile, version: 1.5 },
    { ...profile, displayName: 1 }, { ...profile, biography: [] }, { ...profile, publicationState: {} }])(
    "rejects malformed profile %#", async payload => {
      fetchMock.mockResolvedValueOnce(Response.json(payload));
      expect(await readProfile("synthetic-session")).toEqual({ state: "unavailable" });
    });
  test("read-only SSR refuses session changes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(profile, { headers: { "Set-Cookie": "platform-session-local=rotated; Path=/; HttpOnly; SameSite=Lax" } }));
    expect(await readProfile("synthetic-session")).toEqual({ state: "unavailable" });
  });
});

describe("transport headers", () => {
  const send = async (headers: Record<string, string>, body?: string) => {
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await sessionConfiguration("synthetic-session").fetchApi!("http://localhost:8080/api/v1/profile", { method: "PATCH", headers, body });
    return Object.fromEntries(new Headers(fetchMock.mock.calls[0][1]?.headers));
  };
  test("only a JSON body type and CSRF pass through; other caller headers are dropped", async () => {
    expect(await send({ "Content-Type": "application/json", "X-CSRF-TOKEN": "token", Authorization: "Bearer private",
      Cookie: "other=private", "X-Forwarded-Host": "evil.test" }, "{}"))
      .toEqual({ "content-type": "application/json", cookie: "platform-session-local=synthetic-session", "x-csrf-token": "token" });
  });
  test.each([[{ "Content-Type": "text/html" }, "{}"], [{ "Content-Type": "application/json" }, undefined]] as const)(
    "never forwards other or body-less content types %#", async (headers, body) => {
      expect(await send(headers, body)).toEqual({ cookie: "platform-session-local=synthetic-session" });
    });
});

describe("create profile", () => {
  test.each([null, "", "https://evil.test", "http://localhost:3000.evil.test"])("rejects origin %s before any API call", async value => {
    expect(await createProfile(value, "synthetic-session", vi.fn())).toBe("forbidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("requires a session", async () => {
    expect(await createProfile(origin, undefined, vi.fn())).toBe("signedOut");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("bootstraps CSRF and posts without a body", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json(profile));
    expect(await createProfile(origin, "synthetic-session", vi.fn())).toBe("ready");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:8080/api/v1/profile");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(init?.body).toBeUndefined();
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      cookie: "platform-session-local=synthetic-session", "x-csrf-token": "fresh-token" });
  });
  test.each([[401, "expired"], [403, "forbidden"]] as const)("authoritative %s is not retried", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await createProfile(origin, "synthetic-session", vi.fn())).toBe(state);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("ambiguous failure recovers from a fresh read", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockRejectedValueOnce(new Error("synthetic-private-error"))
      .mockResolvedValueOnce(Response.json(profile));
    expect(await createProfile(origin, "synthetic-session", vi.fn())).toBe("ready");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "GET" });
  });
  test.each([[problem(404), "unavailable"], [problem(500), "unavailable"], [problem(401), "expired"]] as const)(
    "unconfirmed failure is never success %#", async (refresh, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(503)).mockResolvedValueOnce(refresh);
      expect(await createProfile(origin, "synthetic-session", vi.fn())).toBe(state);
    });
});

describe("save profile", () => {
  test("rejects a foreign origin before any API call", async () => {
    expect(await saveProfile("https://evil.test", "synthetic-session", vi.fn(), draft)).toEqual({ state: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("sends both fields and the version with CSRF", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json({ ...profile, biography: "", version: 4 }));
    expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft))
      .toEqual({ state: "saved", profile: { ...profile, biography: "", version: 4 } });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:8080/api/v1/profile");
    expect(init).toMatchObject({ method: "PATCH", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(JSON.parse(String(init?.body))).toEqual(draft);
    // The API rejects a JSON body sent without its media type (415).
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ "content-type": "application/json",
      cookie: "platform-session-local=synthetic-session", "x-csrf-token": "fresh-token" });
  });
  test.each([[400, { state: "invalid" }], [401, { state: "expired" }], [403, { state: "forbidden" }], [500, { state: "unavailable" }]] as const)(
    "maps HTTP %s without retrying", async (status, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
      expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  test("stale edit returns the latest version for review and is never retried", async () => {
    const latest = { ...profile, displayName: "Edited elsewhere", version: 5 };
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(409)).mockResolvedValueOnce(Response.json(latest));
    expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "conflict", latest });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "GET" });
  });
  test.each([[problem(503), { state: "conflict" }], [problem(401), { state: "expired" }]] as const)(
    "stale edit with failed refresh stays a conflict or auth failure %#", async (refresh, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(409)).mockResolvedValueOnce(refresh);
      expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual(expected);
    });
  test("transport failure or malformed success is never reported as saved", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockRejectedValueOnce(new Error("synthetic-private-error"));
    expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({}));
    expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
  });
  test("parallel users never share session or CSRF state", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const headers = new Headers(init?.headers);
      const session = headers.get("cookie")!.split("=")[1];
      if (String(url).endsWith("/csrf")) return csrf(`token-${session}`);
      expect(headers.get("X-CSRF-TOKEN")).toBe(`token-${session}`);
      return Response.json({ ...profile, slug: `dr-${session}` });
    });
    const results = await Promise.all(["user-a", "user-b"].map(session => saveProfile(origin, session, vi.fn(), draft)));
    expect(results.map(result => result.state === "saved" && result.profile.slug)).toEqual(["dr-user-a", "dr-user-b"]);
  });
  test("failures are safe and never logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockRejectedValue(new Error("synthetic-private-error"));
      expect(await readProfile("synthetic-session")).toEqual({ state: "unavailable" });
      expect(await saveProfile(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
