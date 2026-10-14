import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const state = JSON.parse(readFileSync("reports/integration-state.json", "utf8"));
assert.match(state.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
export default defineConfig({
  testDir: "./tests/integration/browser",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: state.origin, trace: "off" },
  projects: [
    { name: "edge-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "edge-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
