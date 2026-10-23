import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./web/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 20_000,
  expect: { timeout: 7_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
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
