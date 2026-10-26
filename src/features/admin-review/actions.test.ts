import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/review", () => ({ decideDoctor: vi.fn(), rejectDoctor: vi.fn(), approveCredential: vi.fn(), rejectCredential: vi.fn() }));
import { approveCredential, decideDoctor, rejectCredential, rejectDoctor } from "@/lib/api/review";
import { decideCredentialAction, decideDoctorAction } from "./actions";

const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const target = (action: Promise<unknown>) => action.then(() => undefined, (error: Error) => error.message.replace("redirect:", ""));
const doctorPage = (state: string) => `/en/admin/doctors/${organizationId}?outcome=${state}#review-outcome`;
const credentialPage = (state: string) => `/en/admin/credentials/${credentialId}?outcome=${state}#review-outcome`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test.each([["approve", "approved"], ["suspend", "suspended"], ["reinstate", "reinstated"]] as const)(
  "%s sends the reviewed revision and reloads with the outcome", async (decision, outcome) => {
    vi.mocked(decideDoctor).mockResolvedValue({ state: "decided" });
    expect(await target(decideDoctorAction("en", organizationId, decision, form({ revision: "7", role: "ADMIN" })))).toBe(doctorPage(outcome));
    const [origin, session, , id, kind, revision] = vi.mocked(decideDoctor).mock.calls[0];
    expect([origin, session, id, kind, revision]).toEqual(["http://localhost:3000", "synthetic", organizationId, decision, 7]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/en/admin/doctors/${organizationId}`);
  });
test("rejection sends the trimmed reason", async () => {
  vi.mocked(rejectDoctor).mockResolvedValue({ state: "decided" });
  expect(await target(decideDoctorAction("en", organizationId, "reject", form({ revision: "7", reason: "  Synthetic reason \n" }))))
    .toBe(doctorPage("rejected"));
  expect(vi.mocked(rejectDoctor).mock.calls[0].slice(3)).toEqual([organizationId, 7, "Synthetic reason"]);
});
test("a stale decision reloads for a new review and is never retried", async () => {
  vi.mocked(decideDoctor).mockResolvedValue({ state: "conflict" });
  expect(await target(decideDoctorAction("en", organizationId, "approve", form({ revision: "7" })))).toBe(doctorPage("conflict"));
  expect(decideDoctor).toHaveBeenCalledTimes(1);
});
test.each([[{}, "invalid"], [{ revision: "x" }, "invalid"], [{ revision: "-1" }, "invalid"], [{ revision: "1".repeat(16) }, "invalid"],
  [{ revision: "7", reason: "   " }, "reasonRequired"]])("rejects %j before any API call", async (entries, outcome) => {
  expect(await target(decideDoctorAction("en", organizationId, "reject", form(entries)))).toBe(doctorPage(outcome));
  expect(rejectDoctor).not.toHaveBeenCalled();
});
test.each([["xx", organizationId, "approve"], ["en", "../x", "approve"], ["en", organizationId, "publish"], ["en", organizationId, "toString"]])(
  "ignores tampered bound arguments %s %s %s", async (locale, id, decision) => {
    expect(await target(decideDoctorAction(locale, id, decision, form({ revision: "1" })))).toBeUndefined();
    expect(decideDoctor).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
test("credential decisions use the reviewed revision and reason", async () => {
  vi.mocked(approveCredential).mockResolvedValue({ state: "decided" });
  vi.mocked(rejectCredential).mockResolvedValue({ state: "forbidden" });
  expect(await target(decideCredentialAction("en", credentialId, "approve", form({ revision: "3" })))).toBe(credentialPage("approved"));
  expect(await target(decideCredentialAction("en", credentialId, "reject", form({ revision: "3", reason: "Unreadable" }))))
    .toBe(credentialPage("forbidden"));
  expect(vi.mocked(approveCredential).mock.calls[0].slice(3)).toEqual([credentialId, 3]);
  expect(vi.mocked(rejectCredential).mock.calls[0].slice(3)).toEqual([credentialId, 3, "Unreadable"]);
});
test.each(["suspend", "reinstate", "x"])("credentials cannot be %s", async decision => {
  expect(await target(decideCredentialAction("en", credentialId, decision, form({ revision: "3" })))).toBeUndefined();
  expect(approveCredential).not.toHaveBeenCalled();
});
