import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("admin can create and publish a post", async ({ page }) => {
  await page.goto("/admin/login");

  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/admin\/dashboard/);
  await expect(page.getByRole("heading", { name: /content health/i })).toBeVisible();

  await page.getByRole("link", { name: "Posts" }).click();
  await expect(page).toHaveURL(/admin\/posts/);

  await page.getByRole("link", { name: /new post/i }).click();
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const title = `Playwright Post ${Date.now()}`;

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Published via Playwright test");
  await page.getByLabel("Content").fill("# Hello from Playwright\n\nThis post was created automatically.");

  await page.waitForTimeout(2000);

  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.waitForTimeout(2000);

  await page.goto("/");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});
