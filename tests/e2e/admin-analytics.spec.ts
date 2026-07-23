import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test("superadmin can view analytics dashboard", async ({ page }) => {
  await loginAsSuperadmin(page);

  await page.goto("/admin/analytics");
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible();
  await expect(page.getByTestId("metric-posts")).toContainText(/Total posts/i);
  await expect(page.getByTestId("analytics-chart")).toBeVisible();
});
