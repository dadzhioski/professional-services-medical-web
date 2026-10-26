import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/credentials", () => ({ addEvidence: vi.fn(), removeEvidence: vi.fn(), createCredential: vi.fn(),
  updateCredentialFields: vi.fn(), submitForReview: vi.fn(), deleteCredential: vi.fn() }));
import { addEvidence, createCredential, deleteCredential, removeEvidence, submitForReview, updateCredentialFields,
  type Credential } from "@/lib/api/credentials";
import { addCredentialEvidence, removeCredential, removeCredentialEvidence, saveCredential, submitCredential } from "./actions";

const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const mediaId = "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5";
const image = new File([new Uint8Array(8)], "diploma.jpg", { type: "image/jpeg" });
const form = (entries: Record<string, string | File>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const target = (action: Promise<unknown>) => action.then(() => undefined, (error: Error) => error.message.replace("redirect:", ""));
const back = (state: string, locale = "en") => `/${locale}/provider/credentials?evidence=${state}#evidence-outcome`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test("add passes origin, session, credential, version and file, then reloads with the outcome", async () => {
  vi.mocked(addEvidence).mockResolvedValue({ state: "saved" });
  expect(await target(addCredentialEvidence("en", form({ credentialId, version: "2", evidence: image })))).toBe(back("saved"));
  const [origin, session, , id, version, file] = vi.mocked(addEvidence).mock.calls[0];
  expect([origin, session, id, version, file]).toEqual(["http://localhost:3000", "synthetic", credentialId, 2, image]);
});
test.each([
  [{ credentialId, version: "2" }, "noFile"],
  [{ credentialId, version: "2", evidence: new File([new Uint8Array(10_485_761)], "big.jpg") }, "tooLarge"],
  [{ credentialId, evidence: image }, "invalid"],
] as const)("unsendable input %# is reported without calling the API", async (entries, state) => {
  expect(await target(addCredentialEvidence("en", form(entries)))).toBe(back(state));
  expect(addEvidence).not.toHaveBeenCalled();
});
test("remove passes the credential, version and image, then reloads with the outcome", async () => {
  vi.mocked(removeEvidence).mockResolvedValue({ state: "removed" });
  expect(await target(removeCredentialEvidence("sq", form({ credentialId, version: "2", mediaId })))).toBe(back("removed", "sq"));
  expect(vi.mocked(removeEvidence).mock.calls[0].slice(3)).toEqual([credentialId, 2, mediaId]);
});
test("a missing version or unsupported locale never calls the API", async () => {
  expect(await target(removeCredentialEvidence("en", form({ credentialId, mediaId })))).toBe(back("invalid"));
  expect(await target(addCredentialEvidence("fr", form({ credentialId, version: "2", evidence: image })))).toBeUndefined();
  expect(addEvidence).not.toHaveBeenCalled();
  expect(removeEvidence).not.toHaveBeenCalled();
});

const reloaded = (state: string, locale = "en") => `/${locale}/provider/credentials?credential=${state}#credential-outcome`;
const fields = { type: "SPECIALIZATION", title: "Typed title", issuer: "Typed issuer", issuedOn: "2019-06-01", expiresOn: "" };
const typed = (extra: Record<string, string> = {}) => form({ ...fields, ...extra });
const saved: Credential = { credentialId, version: 4, state: "DRAFT", type: "SPECIALIZATION", title: "Typed title",
  issuer: "Typed issuer", issuedOn: new Date(2019, 5, 1), evidenceMediaIds: [mediaId] };

test("create sends the typed fields without evidence and reloads the list from the API", async () => {
  vi.mocked(createCredential).mockResolvedValue({ state: "saved", record: saved });
  expect(await target(saveCredential("en", undefined, undefined, typed()))).toBe(reloaded("created"));
  const [origin, session, , draft] = vi.mocked(createCredential).mock.calls[0];
  expect([origin, session]).toEqual(["http://localhost:3000", "synthetic"]);
  expect(draft).toEqual({ type: "SPECIALIZATION", title: "Typed title", issuer: "Typed issuer", issuedOn: new Date(2019, 5, 1), expiresOn: undefined });
  expect(draft).not.toHaveProperty("evidenceMediaIds");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/credentials");
});
test("update targets the version shown, or the explicitly chosen newer version", async () => {
  vi.mocked(updateCredentialFields).mockResolvedValue({ state: "saved", record: saved });
  expect(await target(saveCredential("mk", credentialId, undefined, typed({ version: "3" })))).toBe(reloaded("saved", "mk"));
  expect(vi.mocked(updateCredentialFields).mock.calls[0].slice(3, 4).concat(vi.mocked(updateCredentialFields).mock.calls[0][5]))
    .toEqual([credentialId, 3]);
  await target(saveCredential("mk", credentialId, undefined, typed({ version: "3", overwriteVersion: "5" })));
  expect(vi.mocked(updateCredentialFields).mock.calls[1][5]).toBe(5);
});
test("invalid input, a missing version or a malformed ID never call the API and keep the input", async () => {
  expect(await saveCredential("en", undefined, undefined, typed({ expiresOn: "2010-01-01" }))).toEqual({ status: "invalid",
    values: { ...fields, expiresOn: "2010-01-01" }, version: undefined, errors: { expiresOn: "dateOrder" } });
  expect((await saveCredential("en", credentialId, undefined, typed())).status).toBe("invalid");
  expect((await saveCredential("en", "../private", undefined, typed({ version: "1" }))).status).toBe("forbidden");
  expect((await saveCredential("fr", undefined, undefined, typed())).status).toBe("forbidden");
  expect(createCredential).not.toHaveBeenCalled();
  expect(updateCredentialFields).not.toHaveBeenCalled();
});
test("a stale update returns the latest owner-visible values only", async () => {
  vi.mocked(updateCredentialFields).mockResolvedValue({ state: "conflict", latest: { ...saved, rejectionReason: "Synthetic feedback",
    expiresOn: new Date(2030, 0, 2) } });
  const state = await saveCredential("en", credentialId, undefined, typed({ version: "3" }));
  expect(state).toEqual({ status: "conflict", values: fields, version: 3, errors: {}, latest: { type: "SPECIALIZATION",
    title: "Typed title", issuer: "Typed issuer", issuedOn: "2019-06-01", expiresOn: "2030-01-02", version: 4 } });
});
test.each([["invalid", "rejected"], ["notFound", "notFound"], ["expired", "expired"], ["unavailable", "unavailable"]] as const)(
  "API outcome %s is shown as %s with the input kept", async (result, status) => {
    vi.mocked(updateCredentialFields).mockResolvedValue({ state: result });
    expect(await saveCredential("en", credentialId, undefined, typed({ version: "3" })))
      .toEqual({ status, values: fields, version: 3, errors: {} });
  });
test.each(["submitted", "conflict", "evidenceRequired", "missing", "forbidden"] as const)("submission %s reloads with that outcome", async state => {
  vi.mocked(submitForReview).mockResolvedValue({ state });
  expect(await target(submitCredential("en", form({ credentialId, version: "2" })))).toBe(reloaded(state));
  expect(vi.mocked(submitForReview).mock.calls[0].slice(3)).toEqual([credentialId, 2]);
});
test("submission without a version never calls the API", async () => {
  expect(await target(submitCredential("en", form({ credentialId })))).toBe(reloaded("invalid"));
  expect(submitForReview).not.toHaveBeenCalled();
});
test.each(["removed", "conflict", "missing"] as const)("removal %s reloads with that outcome", async state => {
  vi.mocked(deleteCredential).mockResolvedValue({ state });
  expect(await target(removeCredential("bg", credentialId, 7))).toBe(reloaded(state, "bg"));
  expect(vi.mocked(deleteCredential).mock.calls[0].slice(3)).toEqual([credentialId, 7]);
});
