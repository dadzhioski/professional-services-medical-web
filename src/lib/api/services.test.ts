import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createService, deleteService, listServices, updateService } from "./services";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const serviceId = "6d0f1f4e-2b4c-4a51-9a51-1c2d3e4f5a6b";
const service = { serviceId, name: "Synthetic consultation", description: "Synthetic description",
  price: { amount: "120.50", currency: "EUR" }, locationIds: ["7e1f2f5e-3c5d-4b62-8b62-2d3e4f5a6b7c"], version: 2 };
const draft = { name: "Synthetic consultation", description: "Synthetic description", locationIds: service.locationIds,
  price: { amount: "0", currency: "MKD" as const } };
const csrf = (token = "synthetic-csrf") => Response.json({ token, headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("list services", () => {
  test("signed-out SSR never calls the API", async () => {
    expect(await listServices()).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("forwards only the session over private transport and keeps prices as strings", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([service, { serviceId: "other", version: 0 }]));
    expect(await listServices("synthetic-session")).toEqual({ state: "ready", records: [service, { serviceId: "other", version: 0 }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/services");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Array.from(new Headers(init?.headers).entries())).toEqual([["cookie", "platform-session-local=synthetic-session"]]);
  });
  test.each([[401, "expired"], [403, "forbidden"], [500, "unavailable"]] as const)("maps HTTP %s safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(problem(status));
    expect(await listServices("synthetic-session")).toEqual({ state });
  });
  test.each([null, {}, [null], [{ ...service, serviceId: "" }], [{ ...service, version: "2" }], [{ ...service, price: { amount: 120.5, currency: "EUR" } }],
    [{ ...service, price: { amount: "1.234", currency: "EUR" } }], [{ ...service, price: { amount: "1", currency: "USD" } }],
    [{ ...service, locationIds: "x" }], [{ ...service, name: 1 }]])("rejects malformed list %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await listServices("synthetic-session")).toEqual({ state: "unavailable" });
  });
});

describe("create service", () => {
  test("rejects a foreign origin before any API call", async () => {
    expect(await createService("https://evil.test", "synthetic-session", vi.fn(), draft)).toEqual({ state: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("posts the exact decimal price string with CSRF and JSON type", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json({ ...service, price: { amount: "0.00", currency: "MKD" } }));
    expect(await createService(origin, "synthetic-session", vi.fn(), draft)).toMatchObject({ state: "saved" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:8080/api/v1/services");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(JSON.parse(String(init?.body))).toEqual(draft);
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ "content-type": "application/json",
      cookie: "platform-session-local=synthetic-session", "x-csrf-token": "fresh-token" });
  });
  test("an absent price is omitted, not sent as zero", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...service, price: undefined }));
    await createService(origin, "synthetic-session", vi.fn(), { name: "Synthetic", locationIds: [] });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ name: "Synthetic", locationIds: [] });
  });
  test.each([[400, { state: "invalid" }], [401, { state: "expired" }], [403, { state: "forbidden" }], [500, { state: "unavailable" }]] as const)(
    "maps HTTP %s without retrying (foreign locations and limits are 400)", async (status, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
      expect(await createService(origin, "synthetic-session", vi.fn(), draft)).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  test("transport failure or malformed success is never reported as saved", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockRejectedValueOnce(new Error("synthetic-private-error"));
    expect(await createService(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({}));
    expect(await createService(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
  });
});

describe("update service", () => {
  test("replaces the full draft with the version", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...service, version: 3 }));
    expect(await updateService(origin, "synthetic-session", vi.fn(), serviceId, draft, 2)).toMatchObject({ state: "saved" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`http://localhost:8080/api/v1/services/${serviceId}`);
    expect(init).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(init?.body))).toEqual({ ...draft, version: 2 });
  });
  test("stale edit returns the latest version for review and is never retried", async () => {
    const latest = { ...service, name: "Edited elsewhere", version: 5 };
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(409)).mockResolvedValueOnce(Response.json(latest));
    expect(await updateService(origin, "synthetic-session", vi.fn(), serviceId, draft, 2)).toEqual({ state: "conflict", latest });
    expect(fetchMock.mock.calls[2]).toEqual([`http://localhost:8080/api/v1/services/${serviceId}`, expect.objectContaining({ method: "GET" })]);
  });
  test.each([[problem(404), { state: "notFound" }], [problem(503), { state: "conflict" }], [problem(401), { state: "expired" }]] as const)(
    "stale edit with failed refresh stays safe %#", async (refresh, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(409)).mockResolvedValueOnce(refresh);
      expect(await updateService(origin, "synthetic-session", vi.fn(), serviceId, draft, 2)).toEqual(expected);
    });
  test("a service removed elsewhere is reported as not found", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(404));
    expect(await updateService(origin, "synthetic-session", vi.fn(), serviceId, draft, 2)).toEqual({ state: "notFound" });
  });
});

describe("delete service", () => {
  test("deletes with CSRF and no body", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await deleteService(origin, "synthetic-session", vi.fn(), serviceId)).toEqual({ state: "removed" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`http://localhost:8080/api/v1/services/${serviceId}`);
    expect(init).toMatchObject({ method: "DELETE" });
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("x-csrf-token")).toBe("fresh-token");
  });
  test.each([[404, { state: "notFound" }], [401, { state: "expired" }], [403, { state: "forbidden" }], [500, { state: "unavailable" }]] as const)(
    "failed deletion %s is never reported as removed", async (status, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
      expect(await deleteService(origin, "synthetic-session", vi.fn(), serviceId)).toEqual(expected);
    });
  test("transport failure is unavailable and never logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockResolvedValueOnce(csrf()).mockRejectedValueOnce(new Error("synthetic-private-error"));
      expect(await deleteService(origin, "synthetic-session", vi.fn(), serviceId)).toEqual({ state: "unavailable" });
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
