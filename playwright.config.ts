import { defineConfig, devices } from "@playwright/test";

const parseBaseURL = (value?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

const baseURL =
  parseBaseURL(process.env.PLAYWRIGHT_BASE_URL) ??
  parseBaseURL(process.env.NEXTAUTH_URL) ??
  "http://127.0.0.1:3000";

const normalizedNextAuthUrl = parseBaseURL(process.env.NEXTAUTH_URL) ?? baseURL;
process.env.NEXTAUTH_URL = normalizedNextAuthUrl;

if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = normalizedNextAuthUrl;
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm start",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXTAUTH_URL: normalizedNextAuthUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
