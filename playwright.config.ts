import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

if (!process.env.CI && existsSync(".env.test")) {
  nodeProcess.loadEnvFile?.(".env.test");
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 30 * 1000,
    baseURL: "http://127.0.0.1:3000",
    navigationTimeout: 60 * 1000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec next dev --hostname 0.0.0.0 --port 3000",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      NEXTAUTH_URL: "http://127.0.0.1:3000",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
