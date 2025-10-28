import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("admin theme preference persists across sections", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);

  const toggle = page.getByRole("button", { name: /mode/i });
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? "light");

  await toggle.click();
  await page.waitForFunction((previous) => document.documentElement.dataset.theme !== previous, initialTheme);

  const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, toggledTheme);

  await page.goto("/admin/analytics");
  const analyticsTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(analyticsTheme).toBe(toggledTheme);

  await page.goto("/admin/users");
  const usersTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(usersTheme).toBe(toggledTheme);
});
