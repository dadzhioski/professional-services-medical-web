import { expect, test } from "vitest";
import { readPriceList, serviceDraft, validateRows, type PriceRow } from "./fields";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};
const row = (values: Partial<PriceRow> = {}): PriceRow =>
  ({ name: "Synthetic", description: "", amount: "", currency: "MKD", remove: false, ...values });

test("rows are read by index, empty new rows are dropped and comma decimals become dots", () => {
  const { rows, forged } = readPriceList(form([["rows", "3"],
    ["serviceId-0", "svc-1"], ["version-0", "4"], ["name-0", "Existing"], ["amount-0", "120,50"], ["currency-0", "EUR"], ["remove-0", "on"],
    ["name-1", " "], ["amount-1", ""], ["currency-1", "MKD"],
    ["name-2", "New\r\nline"], ["description-2", "a\r\nb"], ["amount-2", " 1500 "], ["currency-2", "MKD"]]));
  expect(forged).toBe(false);
  expect(rows).toEqual([
    { serviceId: "svc-1", version: 4, name: "Existing", description: "", amount: "120.50", currency: "EUR", remove: true },
    { serviceId: undefined, version: undefined, name: "New\nline", description: "a\nb", amount: "1500", currency: "MKD", remove: false },
  ]);
});
test("an existing row with an empty name is kept so it can be reported", () => {
  expect(readPriceList(form([["rows", "1"], ["serviceId-0", "svc-1"], ["version-0", "0"], ["name-0", ""]])).rows).toHaveLength(1);
});
test.each<[string, [string, string][]]>([
  ["a malformed identifier", [["serviceId-0", "../x"], ["version-0", "1"]]],
  ["an identifier without a version", [["serviceId-0", "svc-1"]]],
  ["a non-numeric version", [["serviceId-0", "svc-1"], ["version-0", "1e3"]]],
])("%s marks the submission as forged", (_name, entries) => {
  expect(readPriceList(form([["rows", "1"], ["name-0", "x"], ...entries])).forged).toBe(true);
});
test("the row count is capped and a remove flag on a new row is ignored", () => {
  const entries: [string, string][] = [["rows", "999"], ["name-0", "x"], ["remove-0", "on"], ["name-70", "beyond the cap"]];
  expect(readPriceList(form(entries)).rows).toEqual([row({ name: "x", currency: "", serviceId: undefined, version: undefined })]);
});
test("validation checks contract bounds and skips removed rows", () => {
  expect(validateRows([
    row({ name: "  " }), row({ name: "x".repeat(121) }), row({ description: "x".repeat(1001) }),
    row({ amount: "1.999" }), row({ amount: "10", currency: "USD" }), row({ name: "", remove: true, serviceId: "svc" }),
    row({ amount: "0" }), row({ amount: "9999999.99", currency: "EUR" }),
  ], ["EUR", "MKD"])).toEqual({ 0: { name: "required" }, 1: { name: "tooLong" }, 2: { description: "tooLong" }, 3: { amount: "format" },
    4: { currency: "required" } });
});
test("drafts keep text exactly and an empty amount means no price", () => {
  expect(serviceDraft(row({ name: " A ", amount: "0" }), ["loc-1"])).toEqual({ name: " A ", description: undefined, locationIds: ["loc-1"],
    price: { amount: "0", currency: "MKD" } });
  expect(serviceDraft(row({ description: "d" }), []).price).toBeUndefined();
});
test("the untouched suggestion is blank until it gets a price or description", () => {
  const read = (entries: [string, string][]) => readPriceList(form([["rows", "1"], ["suggested-0", "First examination"], ...entries])).rows;
  expect(read([["name-0", "First examination"], ["amount-0", ""]])).toEqual([]);
  expect(read([["name-0", "First examination"], ["amount-0", "1200"]])).toHaveLength(1);
  expect(read([["name-0", "Renamed"], ["amount-0", ""]])).toHaveLength(1);
});
