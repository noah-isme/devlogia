import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

function uniqueEmail() {
  return `playwright+${Date.now()}@devlogia.test`;
}

test("superadmin can create, update, and delete users", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);

  await page.goto("/admin/users");
  await expect(page.getByTestId("user-management")).toBeVisible();

  const email = uniqueEmail();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill("secret123");
  await page.getByLabel("Role").selectOption("editor");
  await page.getByTestId("user-create-submit").click();

  const row = page.locator("tr", { hasText: email }).first();
  await expect(row).toContainText("Editor");

  await row.locator("select").selectOption("writer");
  await row.getByTestId(/user-save/).click();
  await expect(page.getByTestId("user-feedback")).toContainText(/now Writer/i);

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByTestId(/user-delete/).click();
  await expect(row).toHaveCount(0);
});
