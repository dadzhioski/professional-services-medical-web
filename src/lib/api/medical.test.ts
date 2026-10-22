import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readMedical, saveSpecialty } from "./medical";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const medical = { medicalProfileId: "synthetic-private-medical", organizationId: "synthetic-private-org",
  licenseNumber: "SYN-123", registrationBody: "Synthetic Chamber", specialtyId: "spec-1", version: 3 };
const csrf = () => Response.json({ token: "synthetic-csrf", headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

test.each([[Response.json(medical), { state: "ready", medical }], [problem(404), { state: "missing" }], [problem(401), { state: "expired" }],
  [problem(500), { state: "unavailable" }], [Response.json({ ...medical, specialtyId: 5 }), { state: "unavailable" }]] as const)(
  "reads the medical extension safely %#", async (response, expected) => {
    fetchMock.mockResolvedValueOnce(response);
    expect(await readMedical("synthetic-session")).toEqual(expected);
  });
test("signed-out reads never call the API", async () => {
  expect(await readMedical()).toEqual({ state: "signedOut" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("changing the specialty re-sends the current licence details unchanged", async () => {
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(medical))
    .mockResolvedValueOnce(Response.json({ ...medical, specialtyId: "spec-2", version: 4 }));
  expect(await saveSpecialty(origin, "synthetic-session", vi.fn(), "spec-2", 3))
    .toEqual({ state: "saved", record: { ...medical, specialtyId: "spec-2", version: 4 } });
  const [url, init] = fetchMock.mock.calls[2];
  expect(url).toBe("http://localhost:8080/api/v1/medical");
  expect(init).toMatchObject({ method: "PATCH" });
  expect(JSON.parse(String(init?.body))).toEqual({ licenseNumber: "SYN-123", registrationBody: "Synthetic Chamber", specialtyId: "spec-2", version: 3 });
  expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
});
test("clearing the specialty omits it", async () => {
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(medical))
    .mockResolvedValueOnce(Response.json({ ...medical, specialtyId: undefined, version: 4 }));
  await saveSpecialty(origin, "synthetic-session", vi.fn(), undefined, 3);
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ licenseNumber: "SYN-123", registrationBody: "Synthetic Chamber", version: 3 });
});
test("a missing extension is created idempotently, then edited with its version", async () => {
  const created = { ...medical, licenseNumber: undefined, registrationBody: undefined, specialtyId: undefined, version: 0 };
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(404)).mockResolvedValueOnce(Response.json(created))
    .mockResolvedValueOnce(Response.json({ ...created, specialtyId: "spec-1", version: 1 }));
  expect(await saveSpecialty(origin, "synthetic-session", vi.fn(), "spec-1", undefined)).toMatchObject({ state: "saved" });
  expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST" });
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("x-csrf-token")).toBe("synthetic-csrf");
  expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({ specialtyId: "spec-1", version: 0 });
});
test("an extension created elsewhere after the page loaded is a conflict, not an overwrite", async () => {
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(medical));
  expect(await saveSpecialty(origin, "synthetic-session", vi.fn(), "spec-2", undefined)).toEqual({ state: "conflict", latest: medical });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
test("a stale version returns the latest extension for review", async () => {
  const latest = { ...medical, specialtyId: "spec-9", version: 7 };
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(medical)).mockResolvedValueOnce(problem(409))
    .mockResolvedValueOnce(Response.json(latest));
  expect(await saveSpecialty(origin, "synthetic-session", vi.fn(), "spec-2", 3)).toEqual({ state: "conflict", latest });
});
test.each([[400, { state: "invalid" }], [403, { state: "forbidden" }], [500, { state: "unavailable" }]] as const)(
  "an unknown specialty or failure %s is never success", async (status, expected) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(medical)).mockResolvedValueOnce(problem(status));
    expect(await saveSpecialty(origin, "synthetic-session", vi.fn(), "unknown", 3)).toEqual(expected);
  });
test("rejects a foreign origin before any API call", async () => {
  expect(await saveSpecialty("https://evil.test", "synthetic-session", vi.fn(), "spec-1", 3)).toEqual({ state: "forbidden" });
  expect(fetchMock).not.toHaveBeenCalled();
});
