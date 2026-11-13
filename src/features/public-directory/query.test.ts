import { expect, test } from "vitest";
import { directoryHref, parseDirectoryQuery } from "./query";

const specialties = [{ id: "spec-1" }, { id: "spec-2" }];
const cities = [{ id: "city-1" }];

test("known filters and a positive page are accepted; unknown names and empty values are ignored", () => {
  expect(parseDirectoryQuery({ specialty: "spec-2", city: "city-1", page: "3", utm: "x" }, specialties, cities))
    .toEqual({ specialtyId: "spec-2", cityId: "city-1", page: 3, invalid: false });
  expect(parseDirectoryQuery({ specialty: "", city: "" }, specialties, cities))
    .toEqual({ specialtyId: undefined, cityId: undefined, page: 1, invalid: false });
  expect(parseDirectoryQuery({}, undefined, undefined)).toEqual({ page: 1, invalid: false });
});
test.each([
  { specialty: "spec-9" }, { city: "../city-1" }, { specialty: ["spec-1", "spec-2"] }, { page: "0" }, { page: "-1" },
  { page: "1.5" }, { page: "abc" }, { page: "01" }, { page: "1234567" }, { page: ["1", "2"] },
])("invalid input is flagged and never forwarded %#", params => {
  const query = parseDirectoryQuery(params, specialties, cities);
  expect(query.invalid).toBe(true);
  expect(query.specialtyId).toBeUndefined();
  expect(query.cityId).toBeUndefined();
});
test("filters cannot be checked while their reference list is unavailable", () => {
  expect(parseDirectoryQuery({ specialty: "spec-1" }, undefined, cities).invalid).toBe(true);
  expect(parseDirectoryQuery({ city: "city-1" }, specialties, undefined).invalid).toBe(true);
});
test("links omit defaults and encode values", () => {
  expect(directoryHref("en")).toBe("/en/doctors");
  expect(directoryHref("mk", { page: 1 })).toBe("/mk/doctors");
  expect(directoryHref("bg", { specialtyId: "a&b", cityId: "c d", page: 2 })).toBe("/bg/doctors?specialty=a%26b&city=c+d&page=2");
});
