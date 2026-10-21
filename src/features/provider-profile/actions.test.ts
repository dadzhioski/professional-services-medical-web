import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/profile", () => ({ createProfile: vi.fn(), saveProfile: vi.fn() }));
import { createProfile, saveProfile } from "@/lib/api/profile";
import { createProfileDraft, saveProfileDraft } from "./actions";

const profile = { profileId: "synthetic-private-profile", organizationId: "synthetic-private-org", slug: "dr-0000abcd",
  displayName: "Saved name", biography: "Saved biography", publicationState: "DRAFT", version: 4 };
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const submitted = { displayName: "Typed name", biography: "Typed biography" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }, { name: "other", value: "private" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test("create uses origin and selected session, then reloads the editor", async () => {
  vi.mocked(createProfile).mockImplementation(async (origin, session, apply) => {
    expect(origin).toBe("http://localhost:3000");
    expect(session).toBe("synthetic");
    apply({ name: "platform-session-local", value: "rotated", httpOnly: true, path: "/", sameSite: "lax", secure: false });
    return "ready";
  });
  await createProfileDraft("mk");
  expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ value: "rotated" }));
  expect(mocks.redirect).toHaveBeenCalledWith("/mk/provider/profile");
});
test.each(["expired", "forbidden", "unavailable", "signedOut"] as const)("create failure %s never appears as success", async state => {
  vi.mocked(createProfile).mockResolvedValue(state);
  await createProfileDraft("en");
  expect(mocks.redirect).toHaveBeenCalledWith(`/en/provider/profile?notice=${state}`);
});
test("arbitrary locale cannot become a destination", async () => {
  await createProfileDraft("//evil.test");
  expect(createProfile).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(await saveProfileDraft("//evil.test", undefined, form({ ...submitted, version: "1" })))
    .toMatchObject({ status: "forbidden", values: submitted });
  expect(saveProfile).not.toHaveBeenCalled();
});

test("save forwards only the profile fields and version, then shows the saved draft", async () => {
  vi.mocked(saveProfile).mockResolvedValue({ state: "saved", profile });
  const state = await saveProfileDraft("en", { status: "idle", values: submitted, version: 99, errors: {} },
    form({ ...submitted, version: "3", slug: "dr-foreign", organizationId: "foreign-org" }));
  expect(vi.mocked(saveProfile).mock.calls[0][0]).toBe("http://localhost:3000");
  expect(vi.mocked(saveProfile).mock.calls[0][1]).toBe("synthetic");
  expect(vi.mocked(saveProfile).mock.calls[0][3]).toEqual({ ...submitted, version: 3 });
  expect(state).toEqual({ status: "saved", values: { displayName: "Saved name", biography: "Saved biography" }, version: 4, errors: {} });
  expect(JSON.stringify(state)).not.toMatch(/synthetic-private|dr-0000abcd/);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/profile");
});
test("over-long input is rejected locally and kept", async () => {
  const values = { displayName: "x".repeat(256), biography: "Typed biography" };
  expect(await saveProfileDraft("en", undefined, form({ ...values, version: "3" })))
    .toEqual({ status: "invalid", values, version: 3, errors: { displayName: "tooLong" } });
  expect(saveProfile).not.toHaveBeenCalled();
});
test("a missing version is never sent", async () => {
  expect(await saveProfileDraft("en", undefined, form(submitted))).toMatchObject({ status: "invalid", values: submitted });
  expect(saveProfile).not.toHaveBeenCalled();
});
test.each(["invalid", "expired", "forbidden", "unavailable", "signedOut"] as const)("failure %s keeps unsaved input", async state => {
  vi.mocked(saveProfile).mockResolvedValue({ state });
  expect(await saveProfileDraft("en", undefined, form({ ...submitted, version: "3" })))
    .toEqual({ status: state, values: submitted, version: 3, errors: {} });
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
test("stale edit keeps input and offers the latest version for review", async () => {
  vi.mocked(saveProfile).mockResolvedValue({ state: "conflict", latest: { ...profile, version: 7 } });
  expect(await saveProfileDraft("en", undefined, form({ ...submitted, version: "3" }))).toEqual({ status: "conflict", values: submitted,
    version: 3, errors: {}, latest: { displayName: "Saved name", biography: "Saved biography", version: 7 } });
});
test("explicit overwrite sends the reviewed version", async () => {
  vi.mocked(saveProfile).mockResolvedValue({ state: "saved", profile: { ...profile, version: 8 } });
  await saveProfileDraft("en", undefined, form({ ...submitted, version: "3", overwriteVersion: "7" }));
  expect(vi.mocked(saveProfile).mock.calls[0][3]).toEqual({ ...submitted, version: 7 });
});
test("a failed overwrite keeps the stale version so the choice must be made again", async () => {
  vi.mocked(saveProfile).mockResolvedValue({ state: "unavailable" });
  expect(await saveProfileDraft("en", undefined, form({ ...submitted, version: "3", overwriteVersion: "7" })))
    .toMatchObject({ status: "unavailable", version: 3 });
});
