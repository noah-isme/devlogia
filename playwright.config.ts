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
  // Limit parallelism so that concurrent logins don't race against each other
  // on the shared remote DB. 2 workers is a good balance between speed and stability.
  workers: process.env.CI ? 2 : 2,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "tests/e2e/global-setup.ts",
  use: {
    actionTimeout: 30 * 1000,
    baseURL: "http://127.0.0.1:3001",
    navigationTimeout: 60 * 1000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? "pnpm start"
      : "pnpm exec next dev --hostname 0.0.0.0 --port 3001",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      NEXTAUTH_URL: "http://127.0.0.1:3001",
    },
  },
  projects: [
    {
      // Default unauthenticated project (public pages, login page)
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
