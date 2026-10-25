import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createLocation, deleteLocation, listLocations, updateLocation } from "./locations";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const locationId = "7e1f2f5e-3c5d-4b62-8b62-2d3e4f5a6b7c";
const location = { locationId, label: "Synthetic Clinic", displayAddress: "1 Synthetic Street", cityId: "city-1", countryCode: "MK", version: 1 };
const draft = { label: "Synthetic Clinic", displayAddress: "1 Synthetic Street", cityId: "city-1", countryCode: "MK" };
const csrf = () => Response.json({ token: "synthetic-csrf", headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

test("lists the organization's locations through the session-only transport", async () => {
  fetchMock.mockResolvedValueOnce(Response.json([location]));
  expect(await listLocations("synthetic-session")).toEqual({ state: "ready", records: [location] });
  expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/api/v1/locations");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error" });
});
test.each([[{ ...location, countryCode: "mk" }], [{ ...location, cityId: "" }], [{ ...location, displayAddress: 7 }], [{ ...location, version: null }]])(
  "rejects malformed locations %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json([payload]));
    expect(await listLocations("synthetic-session")).toEqual({ state: "unavailable" });
  });
test("creates with CSRF and the exact draft", async () => {
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(location));
  expect(await createLocation(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "saved", record: location });
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(draft);
});
test("an invalid or unknown city reference is reported as invalid", async () => {
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(400));
  expect(await createLocation(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "invalid" });
});
test("updates with the version and re-reads on conflict", async () => {
  const latest = { ...location, label: "Edited elsewhere", version: 4 };
  fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(409)).mockResolvedValueOnce(Response.json(latest));
  expect(await updateLocation(origin, "synthetic-session", vi.fn(), locationId, draft, 1)).toEqual({ state: "conflict", latest });
  expect(fetchMock.mock.calls[1][0]).toBe(`http://localhost:8080/api/v1/locations/${locationId}`);
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ ...draft, version: 1 });
});
test.each([[204, { state: "removed" }], [404, { state: "notFound" }], [503, { state: "unavailable" }]] as const)(
  "delete %s maps safely", async (status, expected) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(status === 204 ? new Response(null, { status }) : problem(status));
    expect(await deleteLocation(origin, "synthetic-session", vi.fn(), locationId)).toEqual(expected);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });
