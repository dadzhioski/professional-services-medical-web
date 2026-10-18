import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/api/identity", () => ({ logoutSession: vi.fn() }));
import { logoutSession } from "@/lib/api/identity";
import { logout } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }, { name: "other", value: "private" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});
test("action uses origin and selected session and propagates approved cookies", async () => {
  vi.mocked(logoutSession).mockImplementation(async (origin, session, apply) => {
    expect(origin).toBe("http://localhost:3000");
    expect(session).toBe("synthetic");
    apply({ name: "platform-session-local", value: "", maxAge: 0, httpOnly: true, path: "/", sameSite: "lax", secure: false });
    return "signedOut";
  });
  await logout("sq");
  expect(mocks.get).toHaveBeenCalledWith("origin");
  expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ maxAge: 0 }));
  expect(mocks.redirect).toHaveBeenCalledWith("/sq/provider");
});
test("action only returns a safe translated notice", async () => {
  vi.mocked(logoutSession).mockResolvedValue("forbidden");
  await logout("en");
  expect(mocks.redirect).toHaveBeenCalledWith("/en/provider?notice=forbidden");
});
test("arbitrary locale cannot become a return destination", async () => {
  await logout("//evil.test");
  expect(logoutSession).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
