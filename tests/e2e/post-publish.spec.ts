import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";
import { openNewPost } from "./utils/admin";
import { openAdminNavLink } from "./utils/navigation";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner123!";

test("admin can create and publish a post", async ({ page }) => {
  await loginAs(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);
  await page.waitForLoadState("networkidle");

  await openAdminNavLink(page, "posts");
  await expect(page).toHaveURL(/admin\/posts/);

  await openNewPost(page);
  await expect(page).toHaveURL(/admin\/posts\/new/);
  await expect(page.getByTestId("post-editor")).toBeVisible();
  await expect(page.getByTestId("post-editor-heading")).toBeVisible();

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
