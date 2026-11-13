import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/locations", () => ({ createLocation: vi.fn(), updateLocation: vi.fn(), deleteLocation: vi.fn() }));
vi.mock("@/lib/api/reference", () => ({ listCities: vi.fn() }));
import { createLocation, deleteLocation } from "@/lib/api/locations";
import { listCities } from "@/lib/api/reference";
import { removeLocation, saveLocation } from "./actions";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const typed = { label: "Synthetic Clinic", countryCode: "MK", cityId: "city-skopje", displayAddress: "1 Synthetic Street" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
  vi.mocked(listCities).mockResolvedValue({ state: "ready", records: [{ id: "city-skopje", code: "skopje", countryCode: "MK" },
    { id: "city-sofia", code: "sofia", countryCode: "BG" }] });
});

test("create sends the public address and refreshes both editors", async () => {
  vi.mocked(createLocation).mockResolvedValue({ state: "saved", record: { locationId: "loc-1", version: 0 } });
  await saveLocation("en", undefined, undefined, form(typed));
  expect(vi.mocked(createLocation).mock.calls[0][3]).toEqual(typed);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/services");
  expect(mocks.redirect).toHaveBeenCalledWith("/en/provider/locations?notice=saved");
});
test("a city from another country is flagged locally and kept", async () => {
  expect(await saveLocation("en", undefined, undefined, form({ ...typed, cityId: "city-sofia" })))
    .toMatchObject({ status: "invalid", errors: { cityId: "mismatch" }, values: { ...typed, cityId: "city-sofia" } });
  expect(createLocation).not.toHaveBeenCalled();
});
test("unavailable reference data leaves the pairing to the API", async () => {
  vi.mocked(listCities).mockResolvedValue({ state: "unavailable" });
  vi.mocked(createLocation).mockResolvedValue({ state: "invalid" });
  expect(await saveLocation("en", undefined, undefined, form({ ...typed, cityId: "city-sofia" }))).toMatchObject({ status: "rejected" });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
test("a failed deletion is never reported as removed", async () => {
  vi.mocked(deleteLocation).mockResolvedValue({ state: "unavailable" });
  await removeLocation("sq", "loc-1");
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
  expect(mocks.redirect).toHaveBeenCalledWith("/sq/provider/locations?notice=unavailable");
});
