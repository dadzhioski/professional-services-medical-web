import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4310", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "node tests/e2e/api-fixture.mjs", url: "http://127.0.0.1:4311/healthz", reuseExistingServer: false },
    { command: "node scripts/start.mjs", url: "http://127.0.0.1:4310/healthz", reuseExistingServer: false,
      env: { API_INTERNAL_URL: "http://127.0.0.1:4311", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: "4310" } },
  ],
});
