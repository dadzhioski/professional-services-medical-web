import { expect, test } from "vitest";
import { publicationKey, readProfileForm } from "./fields";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

test("keeps provider-authored text exactly, normalizing only submitted line breaks", () => {
  expect(readProfileForm(form({ displayName: "  Dr. Synthetic  ", biography: "Line one\r\nLine two\r", version: "4" })))
    .toEqual({ values: { displayName: "  Dr. Synthetic  ", biography: "Line one\nLine two\n" }, errors: {}, version: 4, overwriteVersion: undefined });
});
test("allows an incomplete draft", () => {
  expect(readProfileForm(form({ version: "0" }))).toEqual({ values: { displayName: "", biography: "" }, errors: {}, version: 0, overwriteVersion: undefined });
});
test("applies the published contract limits", () => {
  expect(readProfileForm(form({ displayName: "x".repeat(255), biography: "x".repeat(2000), version: "1" })).errors).toEqual({});
  expect(readProfileForm(form({ displayName: "x".repeat(256), biography: "x".repeat(2001), version: "1" })).errors)
    .toEqual({ displayName: "tooLong", biography: "tooLong" });
  // A CRLF pair counts as one character, as the browser's maxlength does.
  expect(readProfileForm(form({ biography: "\r\n".repeat(2000), version: "1" })).errors).toEqual({});
});
test.each(["", "-1", "1.5", "1e3", "abc", "9".repeat(16)])("rejects version %j", version => {
  expect(readProfileForm(form({ version })).version).toBeUndefined();
});
test("the explicit overwrite choice supplies the reviewed version", () => {
  expect(readProfileForm(form({ version: "2", overwriteVersion: "5" }))).toMatchObject({ version: 2, overwriteVersion: 5 });
  expect(readProfileForm(form({ version: "2", overwriteVersion: "bad" }))).toMatchObject({ version: 2, overwriteVersion: undefined });
});
test("file uploads are never read as text", () => {
  const data = form({ version: "1" });
  data.set("displayName", new Blob(["synthetic"]));
  expect(readProfileForm(data).values.displayName).toBe("");
});
test.each([["DRAFT", "profileEditor.publication.draft"], ["PUBLISHED", "profileEditor.publication.published"],
  ["UNPUBLISHED", "profileEditor.publication.unpublished"], ["SUSPENDED", "profileEditor.publication.unknown"],
  ["toString", "profileEditor.publication.unknown"], [undefined, "profileEditor.publication.unknown"]] as const)(
  "maps publication state %s to an allow-listed key", (state, key) => {
    expect(publicationKey(state)).toBe(key);
  });
