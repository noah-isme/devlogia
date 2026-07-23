import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test("admin can create and publish a post", async ({ page }) => {
  await loginAsSuperadmin(page);
  await expect(page.getByRole("heading", { name: /content health/i })).toBeVisible();

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const timestamp = Date.now();
  const title = `Playwright Post ${timestamp}`;
  const slug = `playwright-post-${timestamp}`;

  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Summary").fill("Published via Playwright test");
  await page.getByLabel("Content").fill("# Hello from Playwright\n\nThis post was created automatically.");

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByRole("button", { name: /update post/i })).toBeVisible();
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();

  await page.goto(`/blog/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
