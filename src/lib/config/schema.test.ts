import { afterEach, describe, expect, test, vi } from "vitest";
import { parseServerEnvironment } from "./schema";
import { publicEnvironment } from "./public";

vi.mock("server-only", () => ({}));
import { getServerEnvironment } from "./server";

const origin = "http://localhost:8080";
afterEach(() => vi.unstubAllEnvs());

describe("environment boundaries", () => {
  test.each(["https://medical.example.test", "http://localhost:3000", "http://127.0.0.1:4310", "http://[::1]:3000"])("accepts explicit public origin %s", value => {
    expect(parseServerEnvironment({ NODE_ENV: "production", API_INTERNAL_URL: origin, PUBLIC_ORIGIN: value + "/" }).publicOrigin).toBe(value);
  });
  test.each([undefined, "", "http://example.test", "https://user:private@example.test", "https://example.test/path",
    "https://example.test/..", "https://example.test?", "https://example.test#", " https://example.test", "https://example.test\n",
    "https://example.test/\\evil", "https://example.test//", "ftp://example.test"])("rejects invalid public origin %#", value => {
    expect(() => parseServerEnvironment({ NODE_ENV: "production", API_INTERNAL_URL: origin, PUBLIC_ORIGIN: value })).toThrow("Invalid environment: PUBLIC_ORIGIN");
  });
  test("public origin is read at runtime, not from spoofed host/environment alternatives", () => {
    vi.stubEnv("PUBLIC_ORIGIN", "https://medical.example.test");
    vi.stubEnv("HOST", "evil.test");
    expect(getServerEnvironment().publicOrigin).toBe("https://medical.example.test");
    vi.stubEnv("PUBLIC_ORIGIN", "https://other.example.test");
    expect(getServerEnvironment().publicOrigin).toBe("https://other.example.test");
  });
  test.each(["development", "test", "production"] as const)("accepts %s", (nodeEnv) => {
    expect(parseServerEnvironment({ NODE_ENV: nodeEnv, PUBLIC_ORIGIN: "http://localhost:3000", API_INTERNAL_URL: origin }))
      .toEqual({ nodeEnv, apiInternalUrl: origin, publicOrigin: "http://localhost:3000" });
  });
  test.each([undefined, "", "staging", "synthetic-secret"])("rejects invalid NODE_ENV", (value) => {
    expect(() => parseServerEnvironment({ NODE_ENV: value, PUBLIC_ORIGIN: "http://localhost:3000", API_INTERNAL_URL: origin })).toThrow(
      "Invalid environment: NODE_ENV must be development, test, or production.",
    );
  });
  test.each([
    ["http://localhost:8080", "http://localhost:8080"],
    ["http://localhost:8080/", "http://localhost:8080"],
    ["https://example.test/", "https://example.test"],
    ["http://[::1]:8080/", "http://[::1]:8080"],
  ])("normalizes %s", (input, normalized) => {
    expect(parseServerEnvironment({ NODE_ENV: "test", PUBLIC_ORIGIN: "http://localhost:3000", API_INTERNAL_URL: input }).apiInternalUrl)
      .toBe(normalized);
  });
  test.each([
    undefined, "", " ", "/api", "localhost:8080", "http:localhost",
    "ftp://example.test", "http://user:synthetic-secret@example.test",
    "http://example.test/api", "http://example.test/?token=synthetic-secret",
    "http://example.test/#secret", "http://example.test?", "http://example.test#",
    "http://example.test/..", "http://example.test//", " http://example.test",
    "http://example.test\n", "http://example.test/\\secret",
  ])("rejects invalid API origin without echoing its value (%#)", (value) => {
    expect(() => parseServerEnvironment({ NODE_ENV: "test", API_INTERNAL_URL: value })).toThrow(
      "Invalid environment: API_INTERNAL_URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
    );
  });
  test("server accessor validates current environment", () => {
    vi.stubEnv("API_INTERNAL_URL", origin);
    expect(getServerEnvironment()).toEqual({ nodeEnv: "test", apiInternalUrl: origin, publicOrigin: "http://localhost:3000" });
    vi.stubEnv("API_INTERNAL_URL", "");
    expect(() => getServerEnvironment()).toThrow("Invalid environment: API_INTERNAL_URL");
  });
  test("public configuration exposes no server values", () => {
    expect(publicEnvironment).toEqual({});
    expect(Object.isFrozen(publicEnvironment)).toBe(true);
  });
});
