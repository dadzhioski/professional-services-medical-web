import { expect, test } from "vitest";
import { referenceLabel } from "./reference";

const labels = { mk: "Кардиологија", en: "Cardiology", bg: "" };

test("uses the API label for mk and en, and the stable code otherwise", () => {
  expect(referenceLabel(labels, "cardiology", "mk")).toBe("Кардиологија");
  expect(referenceLabel(labels, "cardiology", "en")).toBe("Cardiology");
  expect(referenceLabel(labels, "cardiology", "bg")).toBe("cardiology");
  expect(referenceLabel(undefined, "cardiology", "en")).toBe("cardiology");
});
test("Albanian shows the code because the contract has no sq labels", () => {
  expect(referenceLabel({ ...labels, sq: "Kardiologji" } as typeof labels, "cardiology", "sq")).toBe("cardiology");
});
