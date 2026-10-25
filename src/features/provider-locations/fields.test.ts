import { expect, test } from "vitest";
import { locationDraft, readLocationForm } from "./fields";

const cities = new Map([["city-skopje", "MK"], ["city-sofia", "BG"]]);
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const valid = { label: "", countryCode: "MK", cityId: "city-skopje", displayAddress: "1 Synthetic Street" };

test("accepts a public practice address with an optional label", () => {
  const result = readLocationForm(form(valid), cities);
  expect(result.errors).toEqual({});
  expect(locationDraft(result.values)).toEqual({ label: undefined, countryCode: "MK", cityId: "city-skopje", displayAddress: "1 Synthetic Street" });
});
test("a listed city from another country is flagged before the API is called", () => {
  expect(readLocationForm(form({ ...valid, cityId: "city-sofia" }), cities).errors).toEqual({ cityId: "mismatch" });
});
test("unlisted city IDs are left to the API, which stays authoritative", () => {
  expect(readLocationForm(form({ ...valid, cityId: "retired-city" }), cities).errors).toEqual({});
});
test("required references and bounds are checked", () => {
  expect(readLocationForm(form({ label: "x".repeat(121), countryCode: "mk", cityId: "", displayAddress: " " }), cities).errors)
    .toEqual({ label: "tooLong", countryCode: "required", cityId: "required", displayAddress: "required" });
  expect(readLocationForm(form({ ...valid, displayAddress: "x".repeat(256) }), cities).errors).toEqual({ displayAddress: "tooLong" });
});
