import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/api/credentials", () => ({ addEvidence: vi.fn(), removeEvidence: vi.fn() }));
import { addEvidence, removeEvidence } from "@/lib/api/credentials";
import { addCredentialEvidence, removeCredentialEvidence } from "./actions";

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
