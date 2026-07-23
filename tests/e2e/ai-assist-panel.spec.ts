import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test("ai assist panel is disabled without provider", async ({ page }) => {
  await loginAsSuperadmin(page);

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
