import { expect, test } from "vitest";
import { credentialDraft, dateText, readCredentialForm, toDate } from "./fields";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};
const base: [string, string][] = [["type", "LICENSE"], ["title", "  Synthetic licence "], ["issuer", "Synthetic board"],
  ["issuedOn", "2020-01-15"], ["expiresOn", ""], ["version", "3"]];
const replaced = (key: string, value: string) => base.map(([name, current]): [string, string] => [name, name === key ? value : current]);

test("valid input keeps provider text exactly and omits an empty expiry", () => {
  const read = readCredentialForm(form(base));
  expect(read.errors).toEqual({});
  expect(read.version).toBe(3);
  const draft = credentialDraft(read.values);
  expect(draft).toMatchObject({ type: "LICENSE", title: "  Synthetic licence ", issuer: "Synthetic board", expiresOn: undefined });
  expect(dateText(draft.issuedOn)).toBe("2020-01-15");
});
test("dates round-trip as the local calendar day the generated client uses", () => {
  for (const value of ["0099-03-01", "2024-02-29", "2031-12-31"]) {
    const date = toDate(value)!;
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
    expect(dateText(date)).toBe(value);
  }
  for (const value of ["2023-02-29", "2020-13-01", "2020-1-5", "15.01.2020", ""]) expect(toDate(value)).toBeUndefined();
  expect(dateText(undefined)).toBe("");
  expect(dateText(new Date(Number.NaN))).toBe("");
});
test.each([
  ["type", "PATIENT_RECORD", { type: "required" }], ["type", "", { type: "required" }],
  ["title", "   ", { title: "required" }], ["title", "x".repeat(201), { title: "tooLong" }],
  ["issuer", "", { issuer: "required" }], ["issuer", "x".repeat(201), { issuer: "tooLong" }],
  ["issuedOn", "", { issuedOn: "required" }], ["issuedOn", "2020-02-30", { issuedOn: "format" }],
  ["expiresOn", "soon", { expiresOn: "format" }], ["expiresOn", "2020-01-14", { expiresOn: "dateOrder" }],
] as const)("%s %j is reported as %o", (key, value, errors) => {
  expect(readCredentialForm(form(replaced(key, value))).errors).toEqual(errors);
});
test("limits are inclusive and a same-day expiry is allowed", () => {
  const read = readCredentialForm(form([...replaced("title", "x".repeat(200)).filter(([key]) => key !== "expiresOn"), ["expiresOn", "2020-01-15"]]));
  expect(read.errors).toEqual({});
  expect(dateText(credentialDraft(read.values).expiresOn)).toBe("2020-01-15");
});
