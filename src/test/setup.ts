import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", "http://localhost:8080");
  vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:3000");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
