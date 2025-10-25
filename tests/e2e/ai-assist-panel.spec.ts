import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner123";

test("ai assist panel is disabled without provider", async ({ page }) => {
  await loginAs(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.getByRole("link", { name: "Posts" }).click();
  await page.getByRole("link", { name: /new post/i }).click();
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const panel = page.getByRole("heading", { name: "AI Assist" }).locator(".." );
  await expect(panel).toContainText("Disabled");
  await expect(panel).toContainText("Configure AI_PROVIDER to enable AI assistance.");

  const buttons = ["Outline", "Meta", "Tags", "Rephrase"];
  for (const label of buttons) {
    await expect(page.getByRole("button", { name: label })).toBeDisabled();
  }
});
