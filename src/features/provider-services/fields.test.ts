import { expect, test } from "vitest";
import { formatPrice } from "@/lib/price";
import { readServiceForm, serviceDraft } from "./fields";

const currencies = ["EUR", "MKD"];
const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};
const base: [string, string][] = [["name", "Synthetic consultation"], ["description", "Line one\r\nLine two"]];

test("no price stays absent, while 0 and 0.00 are kept exactly as typed", () => {
  const none = readServiceForm(form([...base, ["priceMode", "none"], ["amount", "15"], ["currency", "EUR"]]), currencies);
  expect(none.errors).toEqual({});
  expect(serviceDraft(none.values).price).toBeUndefined();
  for (const amount of ["0", "0.00", "9999999.99", "120.5"]) {
    const priced = readServiceForm(form([...base, ["priceMode", "price"], ["amount", ` ${amount} `], ["currency", "MKD"]]), currencies);
    expect(priced.errors).toEqual({});
    expect(serviceDraft(priced.values).price).toEqual({ amount, currency: "MKD" });
  }
});
test.each(["1.234", "-1", "10000000", "1,50", "01", "1e3", ".5", "abc"])("rejects amount %s locally", amount => {
  expect(readServiceForm(form([...base, ["priceMode", "price"], ["amount", amount], ["currency", "EUR"]]), currencies).errors)
    .toEqual({ amount: "format" });
});
test("a price needs an amount and a contract currency", () => {
  expect(readServiceForm(form([...base, ["priceMode", "price"], ["amount", ""], ["currency", "USD"]]), currencies).errors)
    .toEqual({ amount: "required", currency: "required" });
});
test("name is required and bounded; description keeps line breaks as typed", () => {
  const blank = readServiceForm(form([["name", "   "], ["description", "x".repeat(1001)]]), currencies);
  expect(blank.errors).toEqual({ name: "required", description: "tooLong" });
  expect(readServiceForm(form([["name", "x".repeat(121)]]), currencies).errors).toEqual({ name: "tooLong" });
  expect(readServiceForm(form(base), currencies).values.description).toBe("Line one\nLine two");
});
test("location links are deduplicated, bounded and shape-checked", () => {
  const ids = Array.from({ length: 11 }, (_, index) => ["locationIds", `loc-${index}`] as [string, string]);
  expect(readServiceForm(form([...base, ...ids]), currencies).errors).toEqual({ locationIds: "tooMany" });
  expect(readServiceForm(form([...base, ["locationIds", "loc-1"], ["locationIds", "loc-1"]]), currencies).values.locationIds).toEqual(["loc-1"]);
  expect(readServiceForm(form([...base, ["locationIds", "../foreign"]]), currencies).errors).toEqual({ locationIds: "format" });
});
test("versions are parsed only from plain integers", () => {
  expect(readServiceForm(form([...base, ["version", "3"], ["overwriteVersion", "7"]]), currencies)).toMatchObject({ version: 3, overwriteVersion: 7 });
  expect(readServiceForm(form([...base, ["version", "3.5"]]), currencies).version).toBeUndefined();
});
test("prices are formatted from the decimal string without rounding", () => {
  expect(formatPrice("en", "9999999.99", "EUR")).toBe("€9,999,999.99");
  expect(formatPrice("en", "0.00", "MKD")).toMatch(/0\.00/);
  expect(formatPrice("en", "1.00", "invalid")).toBe("1.00 invalid");
});
