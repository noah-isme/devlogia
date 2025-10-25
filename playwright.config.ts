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
  "http://localhost:3000";

const normalizedNextAuthUrl =
  parseBaseURL(process.env.NEXTAUTH_URL) ??
  parseBaseURL(process.env.NEXTAUTH_URL_INTERNAL) ??
  baseURL;

process.env.NEXTAUTH_URL = normalizedNextAuthUrl;
process.env.NEXTAUTH_URL_INTERNAL =
  process.env.NEXTAUTH_URL_INTERNAL ?? normalizedNextAuthUrl;

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
      NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
