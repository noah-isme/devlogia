import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

function uniqueEmail() {
  return `playwright+${Date.now()}@devlogia.test`;
}

test("superadmin can create, update, and delete users", async ({ page }) => {
  await loginAsSuperadmin(page);

  await page.goto("/admin/users");
  await expect(page.getByTestId("user-management")).toBeVisible();

  const email = uniqueEmail();
  const form = page.getByTestId("user-create-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill("secret123");
  await form.getByLabel("Role").selectOption("editor");

  await page.getByTestId("user-create-submit").click();

  const row = page.locator("tr", { hasText: email }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("Editor");

  await row.locator("select").selectOption("writer");
  await row.getByTestId(/user-save/).click();
  await expect(page.getByText(/Role updated/i)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByTestId(/user-delete/).click();
  await expect(page.getByText(/User removed/i)).toBeVisible();
  await expect(row).toHaveCount(0);
});
