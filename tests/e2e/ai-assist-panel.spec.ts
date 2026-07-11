import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("ai assist panel is disabled without provider", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await expect(page.getByText("Disabled").first()).toBeVisible();
  await expect(page.getByText(/Draft, continue, rewrite/)).toBeVisible();

  const buttons = [
    "Generate Draft",
    "Continue Writing",
    "Rewrite for Clarity",
    "Rewrite Concise",
    "Translate → English",
    "Translate → Indonesian",
  ];
  for (const label of buttons) {
    await expect(page.getByRole("button", { name: label })).toBeDisabled();
  }
});
