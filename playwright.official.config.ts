import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const officialSuitePath = process.env.REALWORLD_E2E_DIR;
if (!officialSuitePath) {
  throw new Error("Set REALWORLD_E2E_DIR to the checkout of realworld-apps/realworld.");
}

export default defineConfig({
  testDir: resolve(officialSuitePath, "specs", "e2e"),
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 15_000,
  retries: 0,
  expect: { timeout: 5_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:8000/api/tags",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm run dev:web -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
