import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { addEvidence, createCredential, deleteCredential, readCredentials, removeEvidence, submitForReview,
  updateCredentialFields } from "./credentials";

const fetchMock = vi.fn<typeof fetch>();
const origin = "http://localhost:3000";
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const evidenceA = "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5";
const evidenceB = "b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6";
const uploaded = "c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7";
const credential = { credentialId, version: 2, revision: 1, state: "APPROVED", type: "LICENSE", title: "Synthetic licence",
  issuer: "Synthetic board", issuedOn: "2020-01-15", expiresOn: "2030-01-15", evidenceMediaIds: [evidenceA] };
const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
const csrf = (token = "synthetic-csrf") => Response.json({ token, headerName: "X-CSRF-TOKEN" });
const problem = (status: number) => new Response(JSON.stringify({ detail: "synthetic-private-error" }),
  { status, headers: { "Content-Type": "application/problem+json" } });
const media = () => Response.json({ mediaId: uploaded, state: "READY" }, { status: 201 });
const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url).replace("http://localhost:8080", "")}`);
const body = (index: number) => JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("read credentials", () => {
  test("signed-out SSR never calls the API", async () => {
    expect(await readCredentials()).toEqual({ state: "signedOut" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("reads the owner's credentials with session-only private transport", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([credential, { ...credential, credentialId: evidenceB, evidenceMediaIds: undefined, expiresOn: undefined }]));
    const result = await readCredentials("synthetic-session");
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.credentials.map(item => item.evidenceMediaIds)).toEqual([[evidenceA], []]);
    // The generated client parses dates in local time; the update test proves they round-trip unchanged.
    expect(result.credentials[0].issuedOn).toBeInstanceOf(Date);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/credentials");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ cookie: "platform-session-local=synthetic-session" });
  });
  test.each([null, {}, [{ ...credential, credentialId: "x" }], [{ ...credential, version: "2" }], [{ ...credential, title: 1 }],
    [{ ...credential, issuedOn: "not-a-date" }], [{ ...credential, evidenceMediaIds: ["../private"] }],
    [{ ...credential, evidenceMediaIds: "x" }]])("rejects malformed list %#", async payload => {
    fetchMock.mockResolvedValueOnce(Response.json(payload));
    expect(await readCredentials("synthetic-session")).toEqual({ state: "unavailable" });
  });
  test.each([[401, "expired"], [403, "forbidden"], [500, "unavailable"]] as const)("maps HTTP %s safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(problem(status));
    expect(await readCredentials("synthetic-session")).toEqual({ state });
  });
});

describe("add evidence", () => {
  test.each([["https://evil.test", credentialId, "forbidden"], [origin, "../credentials", "missing"]] as const)(
    "rejects origin %s or credential %s before any API call", async (from, id, state) => {
      expect(await addEvidence(from, "synthetic-session", vi.fn(), id, 2, image)).toEqual({ state });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  test("rereads the credential, uploads private evidence and resends every field with the new image", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json(credential))
      .mockResolvedValueOnce(media()).mockResolvedValueOnce(Response.json({ ...credential, version: 3, state: "DRAFT" }));
    expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state: "saved" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `GET /api/v1/credentials/${credentialId}`,
      "POST /api/v1/media?purpose=CREDENTIAL_EVIDENCE", `PUT /api/v1/credentials/${credentialId}`]);
    expect(body(3)).toEqual({ type: "LICENSE", title: "Synthetic licence", issuer: "Synthetic board", issuedOn: "2020-01-15",
      expiresOn: "2030-01-15", evidenceMediaIds: [evidenceA, uploaded], version: 2 });
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("x-csrf-token")).toBe("fresh-token");
  });
  test("a credential changed elsewhere is a conflict before any upload", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, version: 5 }));
    expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state: "conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("a full credential is refused before any upload", async () => {
    const ids = [evidenceA, evidenceB, uploaded, "d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9"];
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, evidenceMediaIds: ids }));
    expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state: "full" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test.each([[404, "missing"], [400, "missing"], [401, "expired"]] as const)("credential read %s maps safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state });
  });
  test.each([[413, "tooLarge"], [415, "unsupported"], [422, "invalid"], [429, "busy"]] as const)(
    "upload rejection %s never updates the credential", async (status, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(status));
      expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  test.each([[409, "conflict"], [422, "invalid"], [404, "missing"], [503, "unavailable"], [403, "forbidden"]] as const)(
    "failed update %s discards the new upload", async (status, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(media())
        .mockResolvedValueOnce(problem(status)).mockResolvedValueOnce(new Response(null, { status: 204 }));
      expect(await addEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, image)).toEqual({ state });
      expect(calls().at(-1)).toBe(`DELETE /api/v1/media/${uploaded}`);
    });
});

describe("remove evidence", () => {
  test.each([[credentialId, "../x"], ["x", evidenceA]])("rejects malformed IDs %s %s before any API call", async (id, mediaId) => {
    expect(await removeEvidence(origin, "synthetic-session", vi.fn(), id, 2, mediaId)).toEqual({ state: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("resends the credential without the image and leaves its deletion to the API", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, evidenceMediaIds: [evidenceA, evidenceB] }))
      .mockResolvedValueOnce(Response.json({ ...credential, version: 3 }));
    expect(await removeEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, evidenceA)).toEqual({ state: "removed" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `GET /api/v1/credentials/${credentialId}`, `PUT /api/v1/credentials/${credentialId}`]);
    expect(body(2).evidenceMediaIds).toEqual([evidenceB]);
  });
  test("an image that is not on the credential is never deleted", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential));
    expect(await removeEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, evidenceB)).toEqual({ state: "missing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test.each([[409, "conflict"], [400, "invalid"], [500, "unavailable"]] as const)("failed update %s keeps the image", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(status));
    expect(await removeEvidence(origin, "synthetic-session", vi.fn(), credentialId, 2, evidenceA)).toEqual({ state });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

const draft = { type: "SPECIALIZATION" as const, title: "Synthetic specialty", issuer: "Synthetic chamber",
  issuedOn: new Date(2019, 5, 1), expiresOn: undefined };
const sent = { type: "SPECIALIZATION", title: "Synthetic specialty", issuer: "Synthetic chamber", issuedOn: "2019-06-01" };

describe("create credential", () => {
  test("rejects a foreign origin before any API call", async () => {
    expect(await createCredential("https://evil.test", "synthetic-session", vi.fn(), draft)).toEqual({ state: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("posts only the typed fields with CSRF, so a new draft never carries evidence", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json({ ...credential, ...sent, state: "DRAFT",
      evidenceMediaIds: [] }, { status: 201 }));
    expect(await createCredential(origin, "synthetic-session", vi.fn(), draft)).toMatchObject({ state: "saved" });
    expect(calls()).toEqual(["GET /api/auth/csrf", "POST /api/v1/credentials"]);
    expect(body(1)).toEqual(sent);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("x-csrf-token")).toBe("fresh-token");
  });
  test.each([[400, "invalid"], [401, "expired"], [403, "forbidden"], [500, "unavailable"]] as const)("maps HTTP %s safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await createCredential(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state });
  });
  test("a malformed reply is never treated as saved", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, credentialId: "../x" }, { status: 201 }));
    expect(await createCredential(origin, "synthetic-session", vi.fn(), draft)).toEqual({ state: "unavailable" });
  });
});

describe("update credential fields", () => {
  test("rejects a malformed ID before any API call", async () => {
    expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), "../x", draft, 2)).toEqual({ state: "notFound" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("rereads the credential and resends the current evidence with the new fields", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, evidenceMediaIds: [evidenceA, evidenceB] }))
      .mockResolvedValueOnce(Response.json({ ...credential, ...sent, version: 3, state: "DRAFT" }));
    expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2)).toMatchObject({ state: "saved" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `GET /api/v1/credentials/${credentialId}`, `PUT /api/v1/credentials/${credentialId}`]);
    expect(body(2)).toEqual({ ...sent, evidenceMediaIds: [evidenceA, evidenceB], version: 2 });
  });
  test("a newer credential is a conflict with its latest values, before any write", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ ...credential, version: 5, title: "Edited elsewhere" }));
    const result = await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2);
    expect(result).toMatchObject({ state: "conflict", latest: { version: 5, title: "Edited elsewhere" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test("a write that loses a race rereads the latest version", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(409))
      .mockResolvedValueOnce(Response.json({ ...credential, version: 3 }));
    expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2))
      .toMatchObject({ state: "conflict", latest: { version: 3 } });
  });
  test.each([[500, { state: "conflict" }], [404, { state: "notFound" }], [401, { state: "expired" }]] as const)(
    "a conflict whose reread fails with %s stays safe", async (reread, expected) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(409))
        .mockResolvedValueOnce(problem(reread));
      expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2)).toEqual(expected);
    });
  test.each([[400, "invalid"], [422, "invalid"], [404, "notFound"], [403, "forbidden"], [503, "unavailable"]] as const)(
    "a refused write %s maps safely", async (status, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json(credential)).mockResolvedValueOnce(problem(status));
      expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2)).toEqual({ state });
    });
  test.each([[404, "notFound"], [400, "notFound"], [401, "expired"]] as const)("a failed reread %s maps safely", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await updateCredentialFields(origin, "synthetic-session", vi.fn(), credentialId, draft, 2)).toEqual({ state });
  });
});

describe("submit credential", () => {
  test("submits the version shown with CSRF", async () => {
    fetchMock.mockResolvedValueOnce(csrf("fresh-token")).mockResolvedValueOnce(Response.json({ ...credential, state: "SUBMITTED", version: 3 }));
    expect(await submitForReview(origin, "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state: "submitted" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `POST /api/v1/credentials/${credentialId}/submit`]);
    expect(body(1)).toEqual({ version: 2 });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("x-csrf-token")).toBe("fresh-token");
  });
  test.each([[409, "conflict"], [422, "evidenceRequired"], [404, "missing"], [400, "missing"], [401, "expired"], [500, "unavailable"]] as const)(
    "maps HTTP %s to %s", async (status, state) => {
      fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
      expect(await submitForReview(origin, "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state });
    });
  test("a malformed reply or ID is never reported as submitted", async () => {
    expect(await submitForReview(origin, "synthetic-session", vi.fn(), "x", 2)).toEqual({ state: "missing" });
    expect(await submitForReview("https://evil.test", "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({ state: "SUBMITTED" }));
    expect(await submitForReview(origin, "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state: "unavailable" });
  });
});

describe("delete credential", () => {
  test("deletes the version shown with CSRF", async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await deleteCredential(origin, "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state: "removed" });
    expect(calls()).toEqual(["GET /api/auth/csrf", `DELETE /api/v1/credentials/${credentialId}?version=2`]);
  });
  test.each([[409, "conflict"], [404, "missing"], [403, "forbidden"], [500, "unavailable"]] as const)("maps HTTP %s to %s", async (status, state) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(problem(status));
    expect(await deleteCredential(origin, "synthetic-session", vi.fn(), credentialId, 2)).toEqual({ state });
  });
  test("a malformed ID never reaches the API", async () => {
    expect(await deleteCredential(origin, "synthetic-session", vi.fn(), "../x", 2)).toEqual({ state: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
