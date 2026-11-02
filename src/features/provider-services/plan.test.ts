import { expect, test } from "vitest";
import type { PriceRow } from "./fields";
import { planChanges, rowOf } from "./plan";

const current = [
  { serviceId: "svc-a", version: 1, name: "A", description: "Kept", price: { amount: "100.00", currency: "MKD" as const }, locationIds: ["loc-1"] },
  { serviceId: "svc-b", version: 2, name: "B", locationIds: [] },
];
const rows = (): PriceRow[] => current.map(service => rowOf(service, "MKD"));

test("unchanged rows are not sent", () => {
  expect(planChanges(rows(), current, ["loc-1"]).changes).toEqual([]);
});
test("changes keep linked locations, new rows link every location and creates run before deletes", () => {
  const submitted = rows();
  submitted[0] = { ...submitted[0], amount: "120" };
  submitted[1] = { ...submitted[1], remove: true };
  submitted.push({ name: "New", description: "", amount: "", currency: "MKD", remove: false });
  const { changes } = planChanges(submitted, current, Array.from({ length: 12 }, (_, index) => `loc-${index}`));
  expect(changes.map(change => change.kind)).toEqual(["update", "create", "delete"]);
  expect(changes[0]).toMatchObject({ serviceId: "svc-a", version: 1,
    draft: { name: "A", description: "Kept", price: { amount: "120", currency: "MKD" }, locationIds: ["loc-1"] } });
  expect(changes[1]).toMatchObject({ index: 2, draft: { name: "New", price: undefined } });
  expect(changes[1].kind === "create" && changes[1].draft.locationIds).toHaveLength(10);
});
test("a currency change on a priced row is a change; on an unpriced row it is not", () => {
  const submitted = rows();
  submitted[0] = { ...submitted[0], currency: "EUR" };
  submitted[1] = { ...submitted[1], currency: "EUR" };
  expect(planChanges(submitted, current, []).changes.map(change => change.index)).toEqual([0]);
});
test("rows whose entry no longer exists are reported instead of sent", () => {
  const submitted = [...rows(), { ...rows()[0], serviceId: "svc-gone", name: "Gone" }, { ...rows()[0], serviceId: "svc-gone-2", remove: true }];
  expect(planChanges(submitted, current, [])).toEqual({ changes: [], removedElsewhere: [2], alreadyRemoved: [3] });
});
test("at the API cap, deletes run before creates", () => {
  const full = Array.from({ length: 50 }, (_, index) => ({ serviceId: `svc-${index}`, version: 0, name: `S${index}` }));
  const submitted: PriceRow[] = full.map(service => rowOf(service, "MKD"));
  submitted[0].remove = true;
  submitted.push({ name: "New", description: "", amount: "", currency: "MKD", remove: false });
  expect(planChanges(submitted, full, []).changes.map(change => change.kind)).toEqual(["delete", "create"]);
});
