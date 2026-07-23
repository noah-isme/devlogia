import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test("admin theme preference persists across sections", async ({ page }) => {
  await loginAsSuperadmin(page);

  const toggle = page.getByRole("button", { name: /mode/i });
  const initialTheme = await page.evaluate(
    () => document.documentElement.dataset.theme ?? "light",
  );

  await toggle.click();
  await page.waitForFunction(
    (previous) => document.documentElement.dataset.theme !== previous,
    initialTheme,
  );

  const toggledTheme = await page.evaluate(
    () => document.documentElement.dataset.theme,
  );
  await page.reload();
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    toggledTheme,
  );

  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${toggledTheme} mode$`, "i"),
    }),
  ).toHaveAttribute("aria-pressed", toggledTheme === "dark" ? "true" : "false");
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    toggledTheme,
  );
  const analyticsTheme = await page.evaluate(
    () => document.documentElement.dataset.theme,
  );
  expect(analyticsTheme).toBe(toggledTheme);

  await page.goto("/admin/users");
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${toggledTheme} mode$`, "i"),
    }),
  ).toHaveAttribute("aria-pressed", toggledTheme === "dark" ? "true" : "false");
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    toggledTheme,
  );
  const usersTheme = await page.evaluate(
    () => document.documentElement.dataset.theme,
  );
  expect(usersTheme).toBe(toggledTheme);
});
