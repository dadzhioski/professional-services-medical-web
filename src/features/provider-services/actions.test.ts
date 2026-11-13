import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), get: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks, headers: async () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/api/services", () => ({ listServices: vi.fn(), createService: vi.fn(), updateService: vi.fn(), deleteService: vi.fn() }));
vi.mock("@/lib/api/locations", () => ({ listLocations: vi.fn() }));
import { listLocations } from "@/lib/api/locations";
import { createService, deleteService, listServices, updateService } from "@/lib/api/services";
import { savePriceList } from "./actions";

const existing = [
  { serviceId: "svc-a", version: 3, name: "Consultation", price: { amount: "1500.00", currency: "MKD" as const }, locationIds: ["loc-1"] },
  { serviceId: "svc-b", version: 0, name: "Follow-up", locationIds: [] },
];
const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};
// The list as rendered, with the given rows changed and any extra entries appended.
const rendered = (changes: Record<string, string> = {}, extra: [string, string][] = []) => form([["rows", "3"],
  ["serviceId-0", "svc-a"], ["version-0", "3"], ["name-0", "Consultation"], ["amount-0", "1500.00"], ["currency-0", "MKD"],
  ["serviceId-1", "svc-b"], ["version-1", "0"], ["name-1", "Follow-up"], ["amount-1", ""], ["currency-1", "MKD"],
  ["name-2", ""], ["amount-2", ""], ["currency-2", "MKD"], ...extra].map(([key, value]) => [key, changes[key] ?? value]));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([{ name: "platform-session-local", value: "synthetic" }]);
  mocks.get.mockReturnValue("http://localhost:3000");
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: existing });
  vi.mocked(listLocations).mockResolvedValue({ state: "ready", records: [{ locationId: "loc-1", version: 0 }, { locationId: "loc-2", version: 0 }] });
});

test("one save sends only changed rows, links new rows to every location and reloads the list", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "saved", record: { ...existing[0], version: 4 } });
  vi.mocked(createService).mockResolvedValue({ state: "saved", record: { serviceId: "svc-new", version: 0, name: "Ultrasound" } });
  vi.mocked(deleteService).mockResolvedValue({ state: "removed" });
  await savePriceList("en", undefined, rendered({ "amount-0": "1600", "name-2": "Ultrasound" }, [["remove-1", "on"]]));
  expect(vi.mocked(updateService).mock.calls[0].slice(3)).toEqual(["svc-a",
    { name: "Consultation", description: undefined, price: { amount: "1600", currency: "MKD" }, locationIds: ["loc-1"] }, 3]);
  expect(vi.mocked(createService).mock.calls[0][3]).toEqual({ name: "Ultrasound", description: undefined, price: undefined,
    locationIds: ["loc-1", "loc-2"] });
  expect(vi.mocked(deleteService).mock.calls[0][3]).toBe("svc-b");
  expect(vi.mocked(createService).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deleteService).mock.invocationCallOrder[0]);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/provider/services");
  expect(mocks.redirect).toHaveBeenCalledWith("/en/provider/services?notice=saved");
});
test("invalid rows are reported per row and nothing is sent", async () => {
  const state = await savePriceList("en", undefined, rendered({ "name-1": "", "amount-0": "1.999" }));
  expect(state).toMatchObject({ status: "invalid", errors: { 0: { amount: "format" }, 1: { name: "required" } } });
  expect(listServices).not.toHaveBeenCalled();
});
test("a conflict keeps the input, shows the latest entry and adopts its version for an explicit overwrite", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "conflict",
    latest: { serviceId: "svc-a", version: 9, name: "Elsewhere", description: "Changed elsewhere", price: { amount: "1700.00", currency: "MKD" } } });
  const state = await savePriceList("en", undefined, rendered({ "amount-0": "1600" }));
  expect(state.status).toBe("partial");
  expect(state.rows[0]).toMatchObject({ serviceId: "svc-a", version: 9, amount: "1600" });
  expect(state.outcomes).toEqual({ 0: { outcome: "conflict", latest: { name: "Elsewhere", description: "Changed elsewhere",
    amount: "1700.00", currency: "MKD" } } });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
test("saved rows take the API values, removed rows leave the list and outcomes follow their rows", async () => {
  vi.mocked(deleteService).mockResolvedValue({ state: "removed" });
  vi.mocked(createService).mockResolvedValue({ state: "invalid" });
  const state = await savePriceList("en", undefined, rendered({ "name-2": "Rejected" }, [["remove-0", "on"]]));
  expect(state.rows.map(row => row.name)).toEqual(["Follow-up", "Rejected"]);
  expect(state.outcomes).toEqual({ 1: { outcome: "rejected" } });
  expect(mocks.revalidatePath).toHaveBeenCalled();
});
test("an entry removed elsewhere becomes a new row and is not recreated without another save", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [existing[1]] });
  const state = await savePriceList("en", undefined, rendered({ "amount-0": "1600" }));
  expect(state.rows[0]).toMatchObject({ serviceId: undefined, version: undefined, name: "Consultation" });
  expect(state.outcomes).toEqual({ 0: { outcome: "removedElsewhere" } });
  expect(createService).not.toHaveBeenCalled();
  expect(updateService).not.toHaveBeenCalled();
});
test("an update that finds the entry gone is reported the same way", async () => {
  vi.mocked(updateService).mockResolvedValue({ state: "notFound" });
  expect((await savePriceList("en", undefined, rendered({ "amount-0": "1600" }))).outcomes).toEqual({ 0: { outcome: "removedElsewhere" } });
});
test.each(["expired", "forbidden", "unavailable", "signedOut"] as const)("a %s session stops processing and keeps all input", async failure => {
  vi.mocked(updateService).mockResolvedValue({ state: failure });
  const state = await savePriceList("en", undefined, rendered({ "amount-0": "1600", "name-2": "New" }));
  expect(state).toMatchObject({ status: failure, rows: [{ amount: "1600" }, { name: "Follow-up" }, { name: "New" }] });
  expect(createService).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
test.each(["unavailable", "expired"] as const)("a failed %s list read sends nothing", async failure => {
  vi.mocked(listServices).mockResolvedValue({ state: failure });
  expect(await savePriceList("en", undefined, rendered({ "amount-0": "1600" }))).toMatchObject({ status: failure });
  expect(updateService).not.toHaveBeenCalled();
});
test("import adds parsed rows without saving and uses the list's currency", async () => {
  const state = await savePriceList("en", undefined, rendered({ "currency-0": "EUR", "amount-0": "25" },
    [["intent", "import"], ["paste", "Ultrasound – 45\n\nECG 1500 ден"]]));
  expect(state).toMatchObject({ status: "imported", paste: "" });
  expect(state.rows.slice(2)).toMatchObject([{ name: "Ultrasound", amount: "45", currency: "EUR" }, { name: "ECG", amount: "1500", currency: "MKD" }]);
  expect(listServices).not.toHaveBeenCalled();
});
test("an import with nothing usable, or beyond the API maximum, keeps the pasted text", async () => {
  expect(await savePriceList("en", undefined, rendered({}, [["intent", "import"], ["paste", "\n  \n"]])))
    .toMatchObject({ status: "importedNone" });
  const many = Array.from({ length: 49 }, (_, index) => `Entry ${index} 100`).join("\n");
  expect(await savePriceList("en", undefined, rendered({}, [["intent", "import"], ["paste", many]])))
    .toMatchObject({ status: "tooMany", paste: many, rows: [{}, {}] });
});
test("saving with text still in the paste box keeps it and sends nothing", async () => {
  expect(await savePriceList("en", undefined, rendered({ "amount-0": "1600" }, [["paste", "ECG 1500"]])))
    .toMatchObject({ status: "pastePending", paste: "ECG 1500", rows: [{ amount: "1600" }, {}] });
  expect(listServices).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
test("more rows only widens the form", async () => {
  expect(await savePriceList("en", undefined, rendered({}, [["intent", "more"]]))).toMatchObject({ status: "idle", blanks: 10 });
  expect(listServices).not.toHaveBeenCalled();
});
test("arbitrary locales and forged identifiers are refused", async () => {
  expect(await savePriceList("//evil.test", undefined, rendered())).toMatchObject({ status: "forbidden" });
  expect(await savePriceList("en", undefined, rendered({ "serviceId-0": "../x" }))).toMatchObject({ status: "forbidden" });
  expect(listServices).not.toHaveBeenCalled();
});
test("a removal of an entry already gone elsewhere leaves the list even when other rows fail", async () => {
  vi.mocked(listServices).mockResolvedValue({ state: "ready", records: [existing[0]] });
  vi.mocked(updateService).mockResolvedValue({ state: "invalid" });
  const state = await savePriceList("en", undefined, rendered({ "amount-0": "1600" }, [["remove-1", "on"]]));
  expect(state.rows.map(row => row.serviceId)).toEqual(["svc-a"]);
  expect(state.outcomes).toEqual({ 0: { outcome: "rejected" } });
});
test("later calls use the rotated session and a cleared session stops processing", async () => {
  vi.mocked(updateService).mockImplementation(async (_origin, _session, apply) => {
    apply({ name: "platform-session-local", value: "rotated", path: "/", httpOnly: true, secure: false, sameSite: "lax" });
    return { state: "saved", record: { ...existing[0], version: 4 } };
  });
  vi.mocked(createService).mockResolvedValue({ state: "saved", record: { serviceId: "svc-new", version: 0, name: "New" } });
  await savePriceList("en", undefined, rendered({ "amount-0": "1600", "name-2": "New" }));
  expect(vi.mocked(createService).mock.calls[0][1]).toBe("rotated");
  expect(mocks.set).toHaveBeenCalled();
});
