import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("superadmin can view analytics dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);

  await page.goto("/admin/analytics");
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible();
  await expect(page.getByTestId("metric-posts")).toContainText(/Total posts/i);
  await expect(page.getByTestId("analytics-chart")).toBeVisible();
});
