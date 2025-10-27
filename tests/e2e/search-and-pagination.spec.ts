import { expect, test } from "@playwright/test";

test("public readers can paginate and filter", async ({ page }) => {
  await page.goto("/");

  const newerLink = page.getByRole("link", { name: "Newer" });
  const olderLink = page.getByRole("link", { name: "Older" });

  await expect(newerLink).toBeVisible();
  await expect(olderLink).toBeVisible();

  const newerDisabled = (await newerLink.getAttribute("aria-disabled")) === "true";
  const firstNavigationTarget = newerDisabled ? olderLink : newerLink;

  await firstNavigationTarget.click();
  await expect(page).toHaveURL(/cursor=/);

  const returnLink = newerDisabled ? newerLink : olderLink;
  await expect(returnLink).toBeVisible();
  await expect(returnLink).not.toHaveAttribute("aria-disabled", "true");

  await returnLink.click();
  await expect(page).not.toHaveURL(/cursor=/);

  await page.getByPlaceholder("Search posts…").fill("Prisma");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: /Prisma/ })).toBeVisible();

  await page.getByRole("link", { name: /#Prisma/ }).first().click();
  await expect(page.getByRole("link", { name: /#Prisma/ }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/No posts found/i)).toHaveCount(0);
});
