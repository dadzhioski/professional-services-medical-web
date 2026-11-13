import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPublicDirectory } from "./public-directory";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const specialty = { id: "spec-1", code: "cardiology", labels: { mk: "Кардиологија", en: "Cardiology", bg: "Кардиология" } };
const city = { id: "city-1", code: "skopje", labels: { mk: "Скопје", en: "Skopje", bg: "Скопие" } };
const doctor = { slug: "dr-synthetic", displayName: "Synthetic Doctor", photoMediaId: null, specialty, cities: [city] };
const page = { content: [doctor], page: 0, size: 20, totalElements: 1, totalPages: 1 };

test("reads the directory anonymously with encoded filters and no cookie, caching or redirects", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(page));
  expect(await readPublicDirectory("spec 1&x", "city-1", 0)).toEqual({ state: "ready", page });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://localhost:8080/api/v1/public/doctors?specialtyId=spec%201%26x&cityId=city-1&page=0&size=20");
  expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
  expect(Array.from(new Headers(init?.headers).keys())).toEqual([]);
});
test("absent filters are omitted from the query", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ ...page, page: 2, content: [] }));
  expect((await readPublicDirectory(undefined, undefined, 2)).state).toBe("ready");
  expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/api/v1/public/doctors?page=2&size=20");
});
test("Problem Details 400 is an invalid request", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "synthetic-private-error" }), { status: 400 }));
  expect(await readPublicDirectory("bad", undefined, 0)).toEqual({ state: "invalid" });
});
test.each([
  () => new Response(JSON.stringify({ detail: "synthetic-private-error" }), { status: 503 }),
  () => new Response("", { status: 500 }),
  () => new Response("", { status: 404 }),
  () => { throw new TypeError("network"); },
  () => { throw new DOMException("timeout", "TimeoutError"); },
])("transient failures are unavailable %#", async respond => {
  fetchMock.mockImplementationOnce(async () => respond());
  expect(await readPublicDirectory(undefined, undefined, 0)).toEqual({ state: "unavailable" });
});
test.each([
  {}, { ...page, page: 1 }, { ...page, totalPages: -1 }, { ...page, totalElements: 1.5 }, { ...page, size: undefined },
  { ...page, content: undefined }, { ...page, content: [null] }, { ...page, content: Array(21).fill(doctor) },
  { ...page, content: [{ ...doctor, slug: "" }] }, { ...page, content: [{ ...doctor, slug: "x".repeat(201) }] },
  { ...page, content: [{ ...doctor, displayName: " " }] }, { ...page, content: [{ ...doctor, photoMediaId: 5 }] },
  { ...page, content: [{ ...doctor, specialty: { ...specialty, id: "" } }] },
  { ...page, content: [{ ...doctor, cities: [{ ...city, code: 7 }] }] }, { ...page, content: [{ ...doctor, cities: [null] }] },
])("malformed payloads are unavailable %#", async payload => {
  fetchMock.mockResolvedValueOnce(Response.json(payload));
  expect(await readPublicDirectory(undefined, undefined, 0)).toEqual({ state: "unavailable" });
});
test("read-only SSR refuses an API attempt to set a session", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(page, { headers: { "Set-Cookie": "platform-session-local=x; Path=/; HttpOnly" } }));
  expect(await readPublicDirectory(undefined, undefined, 0)).toEqual({ state: "unavailable" });
});
test("fields outside the public contract are dropped by the generated mapping", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ ...page, content: [{ ...doctor, loginEmail: "private@example.test",
    organizationId: "private-org", biography: "private-bio" }] }));
  expect(JSON.stringify(await readPublicDirectory(undefined, undefined, 0))).not.toMatch(/private/);
});
