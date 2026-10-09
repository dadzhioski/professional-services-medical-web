// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SystemStatusStatusEnum, type SystemStatus } from "@dadzhioski/professional-services-api-client";

vi.mock("server-only", () => ({}));
import { getSystemStatus } from "./system-status";

const payload = {
  service: "synthetic-api",
  version: "0.2.0",
  status: SystemStatusStatusEnum.Up,
} satisfies Required<SystemStatus>;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", "http://api.example.test:8080/");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("installed generated status client", () => {
  test("requests the generated endpoint without cache or credentials", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await getSystemStatus()).toEqual({ available: true, data: payload });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test:8080/api/v1/system/status",
      expect.objectContaining({
        method: "GET", cache: "no-store", credentials: "omit",
        redirect: "error", signal: expect.any(AbortSignal), headers: {},
      }),
    );
  });
  test("fetches again after an outage rather than caching a result", async () => {
    fetchMock.mockRejectedValueOnce(new Error("synthetic failure"))
      .mockResolvedValueOnce(Response.json(payload));
    expect(await getSystemStatus()).toEqual({ available: false });
    expect(await getSystemStatus()).toEqual({ available: true, data: payload });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test.each([
    null, {}, [], { ...payload, service: undefined }, { ...payload, version: undefined },
    { ...payload, status: undefined }, { ...payload, service: "" },
    { ...payload, version: "  " }, { ...payload, service: 123 },
    { ...payload, version: {} }, { ...payload, status: "DOWN" },
  ])("handles incomplete/invalid payload (%#)", async (invalid) => {
    fetchMock.mockResolvedValueOnce(Response.json(invalid));
    expect(await getSystemStatus()).toEqual({ available: false });
  });
  test.each([401, 403, 404, 500, 503])("handles HTTP %i without exposing response details", async (status) => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "synthetic-secret" }, { status }));
    expect(await getSystemStatus()).toEqual({ available: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test("handles malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{invalid"));
    expect(await getSystemStatus()).toEqual({ available: false });
  });
  test("discards network errors without logging them", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("http://api.example.test:8080 synthetic-secret"));
    expect(await getSystemStatus()).toEqual({ available: false });
    expect(log).not.toHaveBeenCalled();
  });
  test("aborts a stalled request at five seconds and clears its timer", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const pending = getSystemStatus();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ available: false });
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  test("clears the timeout on success", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    await getSystemStatus();
    expect(vi.getTimerCount()).toBe(0);
  });
  test("invalid configuration fails before any request", async () => {
    vi.stubEnv("API_INTERNAL_URL", "");
    await expect(getSystemStatus()).rejects.toThrow("Invalid environment: API_INTERNAL_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
