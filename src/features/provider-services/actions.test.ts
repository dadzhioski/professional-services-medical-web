import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/services", () => ({ createService: vi.fn(), updateService: vi.fn(), deleteService: vi.fn() }));
import { createService, deleteService, updateService } from "@/lib/api/services";
import { removeService, saveService } from "./actions";

const serviceId = "6d0f1f4e-2b4c-4a51-9a51-1c2d3e4f5a6b";
const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};
const typed: [string, string][] = [["name", "Typed service"], ["description", ""], ["priceMode", "price"], ["amount", "0"],
  ["currency", "EUR"], ["locationIds", "loc-1"]];
const values = { name: "Typed service", description: "", priceMode: "price", amount: "0", currency: "EUR", locationIds: ["loc-1"] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
});

test("create forwards the free price exactly and reloads the list from the API", async () => {
  vi.mocked(createService).mockResolvedValue({ state: "saved", record: { serviceId, version: 0 } });
  await saveService("en", undefined, undefined, form(typed));
  expect(vi.mocked(createService).mock.calls[0].slice(0, 2)).toEqual(["http://localhost:3000", "synthetic"]);
  expect(vi.mocked(createService).mock.calls[0][3]).toEqual({ name: "Typed service", description: undefined, locationIds: ["loc-1"],
    price: { amount: "0", currency: "EUR" } });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/services");
  expect(mocks.redirect).toHaveBeenCalledWith("/en/provider/services?notice=saved");
});
test("update uses the server-bound service ID and the submitted version", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "saved", record: { serviceId, version: 4 } });
  await saveService("mk", serviceId, undefined, form([...typed, ["version", "3"], ["serviceId", "forged"]]));
  expect(vi.mocked(updateService).mock.calls[0][3]).toBe(serviceId);
  expect(vi.mocked(updateService).mock.calls[0][5]).toBe(3);
});
test("an update without a version is never sent", async () => {
  expect(await saveService("en", serviceId, undefined, form(typed))).toMatchObject({ status: "invalid", values });
  expect(updateService).not.toHaveBeenCalled();
});
test("invalid input is kept and not sent", async () => {
  const state = await saveService("en", undefined, undefined, form([["name", ""], ["priceMode", "price"], ["amount", "1.999"], ["currency", "EUR"]]));
  expect(state).toMatchObject({ status: "invalid", errors: { name: "required", amount: "format" } });
  expect(createService).not.toHaveBeenCalled();
});
test.each([["invalid", "rejected"], ["notFound", "notFound"], ["expired", "expired"], ["forbidden", "forbidden"], ["unavailable", "unavailable"]] as const)(
  "API %s keeps unsaved input without claiming success", async (state, status) => {
    vi.mocked(createService).mockResolvedValue({ state });
    expect(await saveService("en", undefined, undefined, form(typed))).toEqual({ status, values, errors: {}, version: undefined });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
test("a stale edit offers the latest version for review", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "conflict", latest: { serviceId, name: "Elsewhere", version: 9 } });
  expect(await saveService("en", serviceId, undefined, form([...typed, ["version", "3"]]))).toMatchObject({ status: "conflict", version: 3,
    latest: { name: "Elsewhere", priceMode: "none", amount: "", locationIds: [], version: 9 } });
});
test("explicit overwrite sends the reviewed version", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "unavailable" });
  expect(await saveService("en", serviceId, undefined, form([...typed, ["version", "3"], ["overwriteVersion", "9"]])))
    .toMatchObject({ status: "unavailable", version: 3 });
  expect(vi.mocked(updateService).mock.calls[0][5]).toBe(9);
});
test("arbitrary locales and identifiers are refused", async () => {
  expect(await saveService("//evil.test", undefined, undefined, form(typed))).toMatchObject({ status: "forbidden" });
  expect(await saveService("en", "../x", undefined, form([...typed, ["version", "1"]]))).toMatchObject({ status: "forbidden" });
  await removeService("en", "../x");
  expect(createService).not.toHaveBeenCalled();
  expect(deleteService).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
test.each(["removed", "notFound", "forbidden", "unavailable"] as const)("removal %s is reported through a safe notice", async state => {
  vi.mocked(deleteService).mockResolvedValue({ state });
  await removeService("bg", serviceId);
  expect(vi.mocked(deleteService).mock.calls[0][3]).toBe(serviceId);
  expect(mocks.redirect).toHaveBeenCalledWith(`/bg/provider/services?notice=${state}`);
  expect(mocks.revalidatePath).toHaveBeenCalledTimes(state === "removed" ? 1 : 0);
});
