import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approveCredential, credentialForReview, decideDoctor, doctorForReview, doctorsForReview, rejectCredential, rejectDoctor,
  submittedCredentials } from "./review";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const otherOrganization = "1c4fad3f-7b2e-4d69-8f80-3e5b9c2d6f71";
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const evidence = "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5";
const doctor = { organizationId, approvalState: "PENDING", registeredAt: "2026-10-01T08:00:00Z", revision: 4, suspended: false };
const profile = { displayName: "Synthetic Doctor", biography: "Synthetic biography", publicationState: "DRAFT", slug: "dr-1", version: 2 };
const credential = { credentialId, organizationId, revision: 3, state: "SUBMITTED", type: "LICENSE", title: "Synthetic licence",
  issuer: "Synthetic board", issuedOn: "2020-01-15", submittedAt: "2026-10-20T10:00:00Z", evidenceMediaIds: [evidence] };
const csrf = (token = "synthetic-csrf") => Response.json({ token, headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url).replace("http://localhost:8080", "")}`);
const body = (index: number) => JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("doctor review reads", () => {
  test("signed-out SSR never calls the API", async () => {
    expect(await doctorsForReview(undefined, "PENDING")).toEqual({ state: "signedOut" });
    expect(await doctorForReview(undefined, organizationId)).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("lists doctors by approval state with session-only private transport", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([doctor]));
    const result = await doctorsForReview("synthetic-session", "REJECTED");
    expect(result.state).toBe("ready");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/admin/doctors?approvalState=REJECTED");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ cookie: "platform-session-local=synthetic-session" });
  });
  test.each([null, {}, [{ ...doctor, organizationId: "x" }], [{ ...doctor, revision: "4" }], [{ ...doctor, approvalState: "ADMIN" }],
    [{ ...doctor, suspended: "no" }], [{ ...doctor, registeredAt: "never" }]])("rejects malformed list %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await doctorsForReview("synthetic-session", "PENDING")).toEqual({ state: "unavailable" });
  });
  test.each([[401, "expired"], [403, "forbidden"], [500, "unavailable"]] as const)("maps HTTP %s safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(problem(status));
    expect(await doctorsForReview("synthetic-session", "PENDING")).toEqual({ state });
  });
  test("finds the doctor's revision across every approval state and reads the review profile", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([{ ...doctor, approvalState: "APPROVED",
      suspended: true }])).mockResolvedValueOnce(Response.json([{ ...doctor, organizationId: otherOrganization }]))
      .mockResolvedValueOnce(Response.json(profile));
    const result = await doctorForReview("synthetic-session", organizationId);
    expect(result).toMatchObject({ state: "ready", doctor: { approvalState: "APPROVED", suspended: true, revision: 4 },
      profile: { displayName: "Synthetic Doctor" } });
    expect(calls()).toContain(`GET /api/v1/admin/doctors/${organizationId}/profile`);
  });
  test("a doctor without a profile is still reviewable", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([doctor])).mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(problem(404));
    expect(await doctorForReview("synthetic-session", organizationId)).toMatchObject({ state: "ready", doctor: { revision: 4 } });
  });
  test("unknown or malformed doctors are not found", async () => {
    expect(await doctorForReview("synthetic-session", "../x")).toEqual({ state: "notFound" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementation(async () => Response.json([]));
    expect(await doctorForReview("synthetic-session", organizationId)).toEqual({ state: "notFound" });
  });
  test("a denied list denies the detail", async () => {
    fetchMock.mockImplementation(async () => problem(403));
    expect(await doctorForReview("synthetic-session", organizationId)).toEqual({ state: "forbidden" });
  });
});

describe("credential review reads", () => {
  test("lists submitted credentials", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([credential, { ...credential, evidenceMediaIds: undefined }]));
    const result = await submittedCredentials("synthetic-session");
    expect(result.state).toBe("ready");
    if (result.state === "ready") expect(result.credentials.map(item => item.evidenceMediaIds)).toEqual([[evidence], []]);
    expect(calls()).toEqual(["GET /api/v1/admin/credentials"]);
  });
  test.each([[{ ...credential, credentialId: undefined }], [{ ...credential, organizationId: "x" }], [{ ...credential, revision: undefined }],
    [{ ...credential, state: "PUBLISHED" }], [{ ...credential, title: undefined }], [{ ...credential, evidenceMediaIds: ["../private"] }],
    [{ ...credential, issuedOn: "never" }]])("rejects malformed credential %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await submittedCredentials("synthetic-session")).toEqual({ state: "unavailable" });
  });
  test("reads one credential and maps missing ones to not found", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(404));
    expect((await credentialForReview("synthetic-session", credentialId)).state).toBe("ready");
    expect(await credentialForReview("synthetic-session", credentialId)).toEqual({ state: "notFound" });
    expect(await credentialForReview("synthetic-session", "x")).toEqual({ state: "notFound" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test.each([[401, "expired"], [403, "forbidden"]] as const)("maps HTTP %s safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(problem(status));
    expect(await credentialForReview("synthetic-session", credentialId)).toEqual({ state });
  });
});

describe("decisions", () => {
  test.each(["approve", "suspend", "reinstate"] as const)("%s sends only the reviewed revision with a fresh CSRF token", async decision => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json(doctor));
    expect(await decideDoctor(origin, "synthetic-session", vi.fn(), organizationId, decision, 4)).toEqual({ state: "decided" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `POST /api/v1/admin/doctors/${organizationId}/${decision}`]);
    expect(body(1)).toEqual({ revision: 4 });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("x-csrf-token")).toBe("fresh-token");
  });
  test("rejecting a doctor sends the reason and revision", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...doctor, approvalState: "REJECTED" }));
    expect(await rejectDoctor(origin, "synthetic-session", vi.fn(), organizationId, 4, "Synthetic reason")).toEqual({ state: "decided" });
    expect(body(1)).toEqual({ reason: "Synthetic reason", revision: 4 });
  });
  test("credential decisions target the reviewed credential", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, state: "APPROVED" }))
      .mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, state: "REJECTED" }));
    expect(await approveCredential(origin, "synthetic-session", vi.fn(), credentialId, 3)).toEqual({ state: "decided" });
    expect(await rejectCredential(origin, "synthetic-session", vi.fn(), credentialId, 3, "Unreadable")).toEqual({ state: "decided" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `POST /api/v1/admin/credentials/${credentialId}/approve`,
      "GET /api/auth/csrf", `POST /api/v1/admin/credentials/${credentialId}/reject`]);
    expect(body(1)).toEqual({ revision: 3 });
    expect(body(3)).toEqual({ reason: "Unreadable", revision: 3 });
  });
  test.each([[409, "conflict"], [400, "invalid"], [422, "invalid"], [404, "missing"], [401, "expired"], [403, "forbidden"],
    [500, "unavailable"]] as const)("maps HTTP %s without retrying", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await decideDoctor(origin, "synthetic-session", vi.fn(), organizationId, "approve", 4)).toEqual({ state });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("a malformed decision reply is never shown as decided", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ revision: "x" }));
    expect(await approveCredential(origin, "synthetic-session", vi.fn(), credentialId, 3)).toEqual({ state: "unavailable" });
  });
  test.each([["https://evil.test", organizationId, "forbidden"], [origin, "../x", "missing"]] as const)(
    "rejects origin %s or target %s before any API call", async (from, id, state) => {
      expect(await decideDoctor(from, "synthetic-session", vi.fn(), id, "suspend", 1)).toEqual({ state });
      expect(fetchMock).not.toHaveBeenCalled();
    });
});
