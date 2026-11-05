import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/review", () => ({ decideDoctor: vi.fn(), rejectDoctor: vi.fn() }));
import { decideDoctor, rejectDoctor } from "@/lib/api/review";
import { decideDoctorAction } from "./actions";

const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const target = (action: Promise<unknown>) => action.then(() => undefined, (error: Error) => error.message.replace("redirect:", ""));
const doctorPage = (state: string) => `/en/admin/doctors/${organizationId}?outcome=${state}#review-outcome`;

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
test.each([[{}], [{ revision: "x" }], [{ revision: "-1" }], [{ revision: "1".repeat(16) }]])(
  "rejects %j before any API call", async entries => {
    expect(await target(decideDoctorAction("en", organizationId, "reject", form(entries)))).toBe(doctorPage("invalid"));
    expect(rejectDoctor).not.toHaveBeenCalled();
  });
test("a blank reason keeps the rejection step open", async () => {
  expect(await target(decideDoctorAction("en", organizationId, "reject", form({ revision: "7", reason: "   " }))))
    .toBe(`/en/admin/doctors/${organizationId}?decide=reject&outcome=reasonRequired#decision`);
  expect(rejectDoctor).not.toHaveBeenCalled();
});
test.each([["xx", organizationId, "approve"], ["en", "../x", "approve"], ["en", organizationId, "publish"], ["en", organizationId, "toString"]])(
  "ignores tampered bound arguments %s %s %s", async (locale, id, decision) => {
    expect(await target(decideDoctorAction(locale, id, decision, form({ revision: "1" })))).toBeUndefined();
    expect(decideDoctor).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
