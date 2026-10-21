import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/api/organization", () => ({ onboardWorkspace: vi.fn() }));
import { onboardWorkspace } from "@/lib/api/organization";
import { startOnboarding } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }, { name: "other", value: "private" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});
test("action uses origin and selected session, then shows the workspace", async () => {
  vi.mocked(onboardWorkspace).mockImplementation(async (origin, session, apply) => {
    expect(origin).toBe("http://localhost:3000");
    expect(session).toBe("synthetic");
    apply({ name: "platform-session-local", value: "rotated", httpOnly: true, path: "/", sameSite: "lax", secure: false });
    return "ready";
  });
  await startOnboarding("bg");
  expect(onboardWorkspace).toHaveBeenCalledTimes(1);
  expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ value: "rotated" }));
  expect(mocks.redirect).toHaveBeenCalledWith("/bg/provider");
});
test.each(["expired", "forbidden", "unavailable", "signedOut"] as const)("failure %s never appears as success", async state => {
  vi.mocked(onboardWorkspace).mockResolvedValue(state);
  await startOnboarding("en");
  expect(mocks.redirect).toHaveBeenCalledWith(`/en/provider/onboarding?notice=${state}`);
});
test("form fields such as foreign organization identifiers are never forwarded", async () => {
  vi.mocked(onboardWorkspace).mockResolvedValue("ready");
  const form = new FormData();
  form.set("organizationId", "foreign-org");
  form.set("role", "ADMIN");
  await (startOnboarding as (locale: string, form: FormData) => Promise<void>)("en", form);
  expect(vi.mocked(onboardWorkspace).mock.calls[0]).toHaveLength(3);
  expect(JSON.stringify(vi.mocked(onboardWorkspace).mock.calls[0])).not.toMatch(/foreign-org|ADMIN/);
});
test("arbitrary locale cannot become a return destination", async () => {
  await startOnboarding("//evil.test");
  expect(onboardWorkspace).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
