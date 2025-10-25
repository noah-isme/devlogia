import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";

const WRITER_EMAIL = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
const WRITER_PASSWORD = process.env.SEED_WRITER_PASSWORD ?? "writer123!";

test("writer can only save drafts", async ({ page }) => {
  await loginAs(page, { email: WRITER_EMAIL, password: WRITER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.getByRole("link", { name: "Posts" }).click();
  await page.getByRole("link", { name: /new post/i }).click();
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
  await expect(page.getByLabel("Status").locator("option", { hasText: "PUBLISHED" })).toHaveCount(0);

  const title = `Writer Draft ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Content").fill("Writer guard test content.");

  await page.getByRole("button", { name: /save draft/i }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("DRAFT");
});
