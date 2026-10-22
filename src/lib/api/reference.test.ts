import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { listCities, listCountries, listSpecialties } from "./reference";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const specialty = { id: "spec-1", code: "cardiology", labels: { mk: "Кардиологија", en: "Cardiology", bg: "Кардиология" } };
const city = { id: "city-1", code: "skopje", countryCode: "MK", labels: { en: "Skopje" } };

test("reference lists are anonymous: no cookie or CSRF is forwarded", async () => {
  fetchMock.mockResolvedValueOnce(Response.json([specialty])).mockResolvedValueOnce(Response.json([{ code: "MK" }]))
    .mockResolvedValueOnce(Response.json([city]));
  expect(await listSpecialties()).toEqual({ state: "ready", records: [specialty] });
  expect(await listCountries()).toEqual({ state: "ready", records: [{ code: "MK" }] });
  expect(await listCities()).toEqual({ state: "ready", records: [city] });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["http://localhost:8080/api/v1/reference/specialties",
    "http://localhost:8080/api/v1/reference/countries", "http://localhost:8080/api/v1/reference/cities"]);
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Array.from(new Headers(init?.headers).keys())).toEqual([]);
  }
});
test.each([[problem()], [Response.json({})], [Response.json([{ ...specialty, id: "" }])], [Response.json([{ ...specialty, code: "<b>" }])],
  [Response.json([{ ...specialty, labels: { en: 1 } }])]])("failures and malformed lists are unavailable %#", async response => {
  fetchMock.mockResolvedValueOnce(response);
  expect(await listSpecialties()).toEqual({ state: "unavailable" });
});
test.each([[{ ...city, countryCode: "Macedonia" }], [{ ...city, id: undefined }]])("malformed cities are unavailable %#", async payload => {
  fetchMock.mockResolvedValueOnce(Response.json([payload]));
  expect(await listCities()).toEqual({ state: "unavailable" });
});

function problem() {
  return new Response(JSON.stringify({ detail: "synthetic-private-error" }), { status: 503, headers: { "Content-Type": "application/problem+json" } });
}
