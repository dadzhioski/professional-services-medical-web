import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/profile", () => ({ changePublication: vi.fn() }));
vi.mock("@/lib/api/organization", () => ({ resubmitApproval: vi.fn() }));
import { resubmitApproval } from "@/lib/api/organization";
import { changePublication } from "@/lib/api/profile";
import { changePublicationAction, resubmitApplication } from "./actions";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const target = (action: Promise<unknown>) => action.then(() => undefined, (error: Error) => error.message.replace("redirect:", ""));
const page = (state: string) => `/en/provider/publication?outcome=${state}#publication-outcome`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test.each([["publish", true, "published"], ["unpublish", false, "unpublished"]] as const)(
  "%s sends the version the owner saw", async (change, publish, state) => {
    vi.mocked(changePublication).mockResolvedValue({ state });
    expect(await target(changePublicationAction("en", change, form({ version: "4" })))).toBe(page(state));
    const [origin, session, , flag, version] = vi.mocked(changePublication).mock.calls[0];
    expect([origin, session, flag, version]).toEqual(["http://localhost:3000", "synthetic", publish, 4]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/publication");
  });
test.each(["incomplete", "conflict"] as const)("%s reloads without retrying", async state => {
  vi.mocked(changePublication).mockResolvedValue({ state });
  expect(await target(changePublicationAction("en", "publish", form({ version: "4" })))).toBe(page(state));
  expect(changePublication).toHaveBeenCalledTimes(1);
});
test("a missing version is invalid before any API call", async () => {
  expect(await target(changePublicationAction("en", "publish", form({})))).toBe(page("invalid"));
  expect(changePublication).not.toHaveBeenCalled();
});
test.each([["xx", "publish"], ["en", "approve"], ["en", "true"]])("ignores tampered arguments %s %s", async (locale, change) => {
  expect(await target(changePublicationAction(locale, change, form({ version: "4" })))).toBeUndefined();
  expect(changePublication).not.toHaveBeenCalled();
});
test("resubmission sends the approval revision and returns to the workspace", async () => {
  vi.mocked(resubmitApproval).mockResolvedValue({ state: "resubmitted" });
  expect(await target(resubmitApplication("en", form({ revision: "5", approvalState: "APPROVED" }))))
    .toBe("/en/provider?approval=resubmitted#approval-outcome");
  expect(vi.mocked(resubmitApproval).mock.calls[0].slice(0, 2)).toEqual(["http://localhost:3000", "synthetic"]);
  expect(vi.mocked(resubmitApproval).mock.calls[0][3]).toBe(5);
});
test("resubmission without a revision is invalid before any API call", async () => {
  expect(await target(resubmitApplication("en", form({})))).toBe("/en/provider?approval=invalid#approval-outcome");
  expect(resubmitApproval).not.toHaveBeenCalled();
});
