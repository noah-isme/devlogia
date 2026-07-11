import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function loginAsSuperadmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page).not.toHaveURL(/email=|password=/);
}

test("visual smoke screenshots", async ({ page }, testInfo) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await attachScreenshot(page, testInfo, "admin-login");

  await loginAsSuperadmin(page);
  await expect(page.getByRole("heading", { name: /content health/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-dashboard");

  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: /deep writing/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Older" })).toBeVisible();
  await attachScreenshot(page, testInfo, "blog-index");

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "post-editor-new");
});
