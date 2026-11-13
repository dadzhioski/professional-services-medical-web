import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/api/profile", () => ({ replacePhoto: vi.fn(), removePhoto: vi.fn() }));
import { removePhoto, replacePhoto } from "@/lib/api/profile";
import { changeProfilePhoto, removeProfilePhoto } from "./photo-actions";

const image = new File([new Uint8Array(8)], "photo.png", { type: "image/png" });
const form = (entries: Record<string, string | File>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const target = (action: Promise<unknown>) => action.then(() => undefined, (error: Error) => error.message.replace("redirect:", ""));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }, { name: "other", value: "private" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test("change passes origin, selected session, version and file, then reloads with the outcome", async () => {
  vi.mocked(replacePhoto).mockImplementation(async (origin, session, apply, version, file) => {
    expect([origin, session, version, file]).toEqual(["http://localhost:3000", "synthetic", 4, image]);
    apply({ name: "platform-session-local", value: "rotated", httpOnly: true, path: "/", sameSite: "lax", secure: false });
    return { state: "saved" };
  });
  expect(await target(changeProfilePhoto("en", form({ version: "4", photo: image })))).toBe("/en/provider/profile?photo=saved#photo");
  expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ value: "rotated" }));
});
test.each([
  [{ version: "4" }, "noFile"],
  [{ version: "4", photo: new File([], "empty.png") }, "noFile"],
  [{ version: "4", photo: new File([new Uint8Array(10_485_761)], "big.png") }, "tooLarge"],
  [{ photo: image }, "invalid"],
  [{ version: "x", photo: image }, "invalid"],
] as const)("unsendable input %# is reported without calling the API", async (entries, state) => {
  expect(await target(changeProfilePhoto("en", form(entries)))).toBe(`/en/provider/profile?photo=${state}#photo`);
  expect(replacePhoto).not.toHaveBeenCalled();
});
test("API outcomes are passed through to the allow-listed notice", async () => {
  vi.mocked(replacePhoto).mockResolvedValue({ state: "conflict" });
  expect(await target(changeProfilePhoto("mk", form({ version: "4", photo: image })))).toBe("/mk/provider/profile?photo=conflict#photo");
});
test("remove passes the version and reloads with the outcome", async () => {
  vi.mocked(removePhoto).mockResolvedValue({ state: "removed" });
  expect(await target(removeProfilePhoto("en", form({ version: "4" })))).toBe("/en/provider/profile?photo=removed#photo");
  expect(vi.mocked(removePhoto).mock.calls[0].slice(0, 2)).toEqual(["http://localhost:3000", "synthetic"]);
  expect(vi.mocked(removePhoto).mock.calls[0][3]).toBe(4);
  expect(await target(removeProfilePhoto("en", form({})))).toBe("/en/provider/profile?photo=invalid#photo");
  expect(removePhoto).toHaveBeenCalledTimes(1);
});
test("unsupported locales do nothing", async () => {
  expect(await target(changeProfilePhoto("fr", form({ version: "4", photo: image })))).toBeUndefined();
  expect(await target(removeProfilePhoto("constructor", form({ version: "4" })))).toBeUndefined();
  expect(replacePhoto).not.toHaveBeenCalled();
  expect(removePhoto).not.toHaveBeenCalled();
});
