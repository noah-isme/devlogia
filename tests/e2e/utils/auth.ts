import type { Page } from "@playwright/test";

interface LoginOptions {
  email: string;
  password: string;
  expectedUrl?: RegExp | string;
  timeout?: number;
}

const DEFAULT_REDIRECT = /\/admin\/dashboard(?:\?|$)/;

export async function loginAs(page: Page, options: LoginOptions) {
  const { email, password, expectedUrl = DEFAULT_REDIRECT, timeout = 10_000 } = options;

  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  await Promise.all([
    page.waitForURL(expectedUrl, { timeout }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
}
