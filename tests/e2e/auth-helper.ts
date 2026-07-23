/**
 * Shared auth helper for inline-login test specs.
 * Performs a clean login through the admin login interface to ensure
 * deterministic, isolated user sessions across all tests.
 */

import type { Page } from "@playwright/test";

export async function loginAsSuperadmin(page: Page) {
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 });
}

export async function loginAsWriter(page: Page) {
  const email = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
  const password = process.env.SEED_WRITER_PASSWORD ?? "writer123";

  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 });
}
