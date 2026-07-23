import { expect, test } from "@playwright/test";

import { loginAsWriter } from "./auth-helper";

test("writer can only save drafts", async ({ page }) => {
  await loginAsWriter(page);

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
  await expect(page.getByLabel("Status").locator("option", { hasText: "PUBLISHED" })).toHaveCount(0);

  const title = `Writer Draft ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Content").fill("Writer guard test content.");

  await page.getByRole("button", { name: /save draft/i }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("DRAFT");
});
