import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPublicProfile } from "./public-profile";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const reference = { id: "ref-1", code: "cardiology", labels: { mk: "Кардиологија", en: "Cardiology", bg: "Кардиология" } };
const published = {
  slug: "dr-synthetic", displayName: "Synthetic Doctor", biography: "Synthetic biography", photoMediaId: null, specialty: reference,
  credentials: [{ type: "LICENSE", title: "Synthetic licence", issuer: "Synthetic board", issuedOn: "2020-01-15", expiresOn: null }],
  services: [{ name: "Synthetic consultation", description: null, price: { amount: "25.00", currency: "EUR" } }],
  locations: [{ label: null, displayAddress: "Synthetic street 1", countryCode: "MK", city: { ...reference, code: "skopje" } }],
};

test("reads the published profile anonymously with no cookie, caching or redirects", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(published));
  const result = await readPublicProfile("dr-synthetic");
  expect(result.state).toBe("ready");
  expect(result.state === "ready" && result.profile.credentials?.[0].issuedOn).toEqual(new Date(2020, 0, 15));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://localhost:8080/api/v1/public/profiles/dr-synthetic");
  expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
  expect(Array.from(new Headers(init?.headers).keys())).toEqual([]);
});
test("the slug is path-encoded and must match the response", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ ...published, slug: "a/b?c" }));
  expect((await readPublicProfile("a/b?c")).state).toBe("ready");
  expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/api/v1/public/profiles/a%2Fb%3Fc");
  fetchMock.mockResolvedValueOnce(Response.json(published));
  expect(await readPublicProfile("other-slug")).toEqual({ state: "unavailable" });
});
test("unknown, unpublished and suspended profiles share one missing result", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "synthetic-private-error" }), { status: 404 }));
  expect(await readPublicProfile("dr-hidden")).toEqual({ state: "missing" });
});
test.each(["", "x".repeat(201)])("unusable slugs are missing without an API call %#", async slug => {
  expect(await readPublicProfile(slug)).toEqual({ state: "missing" });
  expect(fetchMock).not.toHaveBeenCalled();
});
test.each([
  () => new Response(JSON.stringify({ detail: "synthetic-private-error" }), { status: 503 }),
  () => new Response("", { status: 500 }),
  () => { throw new TypeError("network"); },
  () => { throw new DOMException("timeout", "TimeoutError"); },
])("transient failures are unavailable, never missing %#", async respond => {
  fetchMock.mockImplementationOnce(async () => respond());
  expect(await readPublicProfile("dr-synthetic")).toEqual({ state: "unavailable" });
});
test.each([
  {}, { ...published, displayName: " " }, { ...published, slug: undefined }, { ...published, biography: 1 },
  { ...published, photoMediaId: 5 }, { ...published, specialty: { ...reference, id: "" } },
  { ...published, credentials: [{ ...published.credentials[0], title: "" }] },
  { ...published, credentials: [{ ...published.credentials[0], issuedOn: "not-a-date" }] },
  { ...published, services: [{ name: "Synthetic", price: { amount: "1e3", currency: "EUR" } }] },
  { ...published, locations: [{ ...published.locations[0], countryCode: "Macedonia" }] },
  { ...published, locations: [null] },
])("malformed payloads are unavailable %#", async payload => {
  fetchMock.mockResolvedValueOnce(Response.json(payload));
  expect(await readPublicProfile("dr-synthetic")).toEqual({ state: "unavailable" });
});
test("read-only SSR refuses an API attempt to set a session", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(published, { headers: { "Set-Cookie": "platform-session-local=x; Path=/; HttpOnly" } }));
  expect(await readPublicProfile("dr-synthetic")).toEqual({ state: "unavailable" });
});
test("fields outside the public contract are dropped by the generated mapping", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ ...published, loginEmail: "private@example.test", organizationId: "private-org",
    licenseNumber: "private-licence" }));
  const result = await readPublicProfile("dr-synthetic");
  expect(JSON.stringify(result)).not.toMatch(/private/);
});
