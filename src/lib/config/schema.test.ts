import { describe, expect, test, vi } from "vitest";
import { parseServerEnvironment } from "./schema";
import { publicEnvironment } from "./public";

vi.mock("server-only", () => ({}));
import { getServerEnvironment } from "./server";

describe("environment boundaries", () => {
  test.each(["development", "test", "production"] as const)("accepts %s", (nodeEnv) => {
    expect(parseServerEnvironment({ NODE_ENV: nodeEnv })).toEqual({ nodeEnv });
  });
  test.each([undefined, "", "staging", "synthetic-secret"])("rejects invalid required values without echoing them", (value) => {
    expect(() => parseServerEnvironment({ NODE_ENV: value })).toThrow(
      "Invalid environment: NODE_ENV must be development, test, or production.",
    );
  });
  test("server accessor validates the current environment", () => {
    expect(getServerEnvironment()).toEqual({ nodeEnv: "test" });
  });
  test("public configuration exposes no server values", () => {
    expect(publicEnvironment).toEqual({});
    expect(Object.isFrozen(publicEnvironment)).toBe(true);
  });
});
