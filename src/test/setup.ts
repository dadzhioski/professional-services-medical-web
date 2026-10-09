import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => vi.stubEnv("API_INTERNAL_URL", "http://localhost:8080"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
