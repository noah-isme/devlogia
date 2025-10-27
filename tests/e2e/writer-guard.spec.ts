import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";
import { openNewPost } from "./utils/admin";
import { openAdminNavLink } from "./utils/navigation";

const WRITER_EMAIL = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
const WRITER_PASSWORD = process.env.SEED_WRITER_PASSWORD ?? "writer123!";

test("writer can only save drafts", async ({ page }) => {
  await loginAs(page, { email: WRITER_EMAIL, password: WRITER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);

  await openAdminNavLink(page, "posts");
  await openNewPost(page);
  await expect(page).toHaveURL(/admin\/posts\/new/);
  await expect(page.getByTestId("post-editor")).toBeVisible();
  await expect(page.getByTestId("post-editor-heading")).toBeVisible();

  await expect(page.getByTestId("post-save-draft")).toBeVisible();
  await expect(page.getByTestId("post-publish")).toHaveCount(0);
  await expect(page.getByLabel("Status").locator("option", { hasText: "PUBLISHED" })).toHaveCount(0);

  const title = `Writer Draft ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Content").fill("Writer guard test content.");

  await page.getByTestId("post-save-draft").click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("DRAFT");
});
