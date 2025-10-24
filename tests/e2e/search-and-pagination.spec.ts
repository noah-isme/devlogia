import { expect, test } from "@playwright/test";

test("public readers can paginate and filter", async ({ page }) => {
  await page.goto("/");

  const olderLink = page.getByRole("link", { name: "Older" });
  await expect(olderLink).toBeVisible();
  await expect(olderLink).not.toHaveAttribute("aria-disabled", "true");

  await olderLink.click();
  await expect(page).toHaveURL(/cursor=/);

  const newerLink = page.getByRole("link", { name: "Newer" });
  await expect(newerLink).toBeVisible();
  await expect(newerLink).not.toHaveAttribute("aria-disabled", "true");

  await newerLink.click();
  await expect(page).not.toHaveURL(/cursor=/);

  await page.getByPlaceholder("Search posts…").fill("Prisma");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: /Prisma/ })).toBeVisible();

  await page.getByRole("link", { name: /#Prisma/ }).first().click();
  await expect(page.getByRole("link", { name: /#Prisma/ }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/No posts found/i)).toHaveCount(0);
});
