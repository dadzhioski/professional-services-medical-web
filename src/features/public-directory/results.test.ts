import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { initials } from "./results";

test("initials take the first letter of up to two name parts, Unicode-safe", () => {
  expect(initials("Synthetic Doctor Name")).toBe("SD");
  expect(initials("  синтетички   лекар ")).toBe("СЛ");
  expect(initials("Ëmri")).toBe("Ë");
  expect(initials("   ")).toBe("");
});
