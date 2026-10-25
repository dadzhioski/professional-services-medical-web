import { expect, test } from "vitest";
import { evidenceOutcomes, formVersion, outcomeMessage, photoOutcomes, selectedImage } from "./form";

test("outcome messages come only from the allow-list", () => {
  expect(outcomeMessage(photoOutcomes, "saved")).toEqual({ key: "photo.saved", success: true });
  expect(outcomeMessage(photoOutcomes, "tooLarge")).toEqual({ key: "media.tooLarge", success: false });
  expect(outcomeMessage(evidenceOutcomes, "missing")).toEqual({ key: "evidence.missingCredential", success: false });
  expect(outcomeMessage(photoOutcomes, "full")).toBeUndefined();
  for (const value of [undefined, "", "constructor", "__proto__", "toString", "<script>", ["saved"]]) {
    expect(outcomeMessage(evidenceOutcomes, value)).toBeUndefined();
  }
});

test("versions are plain non-negative integers", () => {
  const form = (value: string | Blob) => { const data = new FormData(); data.set("version", value); return data; };
  expect(formVersion(form("0"))).toBe(0);
  expect(formVersion(form("42"))).toBe(42);
  for (const value of ["", "-1", "1.5", "1e3", " 1", "9".repeat(16)]) expect(formVersion(form(value))).toBeUndefined();
  expect(formVersion(form(new Blob(["1"])))).toBeUndefined();
  expect(formVersion(new FormData())).toBeUndefined();
});

test("only a present, non-empty image within the byte limit is sent", () => {
  const image = new File([new Uint8Array(4)], "photo.png", { type: "image/png" });
  expect(selectedImage(image)).toBe(image);
  expect(selectedImage(null)).toBe("noFile");
  expect(selectedImage("text")).toBe("noFile");
  expect(selectedImage(new File([], "empty.png"))).toBe("noFile");
  expect(selectedImage(new File([new Uint8Array(10_485_761)], "big.png", { type: "image/png" }))).toBe("tooLarge");
});
