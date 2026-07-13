import { expect, test } from "@playwright/test";

test("public readers can paginate and filter", async ({ page }) => {
  await page.goto("/blog");
  expect(new URL(page.url()).pathname).toBe("/blog");

  const olderLink = page.getByRole("link", { name: "Older" });
  await expect(olderLink).toBeVisible();
  await expect(olderLink).not.toHaveAttribute("aria-disabled", "true");

  await olderLink.click();
  await expect(page).toHaveURL(/\/blog\?.*cursor=/);
  expect(new URL(page.url()).pathname).toBe("/blog");

  const newerLink = page.getByRole("link", { name: "Newer" });
  await expect(newerLink).toBeVisible();
  await expect(newerLink).not.toHaveAttribute("aria-disabled", "true");

  await newerLink.click();
  await expect(page).toHaveURL(/\/blog/);
  await expect(page).not.toHaveURL(/cursor=/);

  await page.getByRole("searchbox", { name: "Search articles" }).fill("Prisma");
  await page.getByRole("button", { name: "Search" }).click();
  const searchUrl = new URL(page.url());
  expect(searchUrl.pathname).toBe("/blog");
  expect(searchUrl.searchParams.get("q")).toBe("Prisma");
  await expect(page.getByRole("heading", { name: /Prisma/ })).toBeVisible();

  const prismaTagLink = page.getByRole("link", { name: "Prisma", exact: true });
  await expect(prismaTagLink.first()).toHaveAttribute(
    "href",
    /\/blog\/tags\/prisma/,
  );
  await prismaTagLink.first().click();
  await expect(page).toHaveURL(/\/blog\/tags\/prisma/);
  const tagUrl = new URL(page.url());
  expect(tagUrl.pathname).toBe("/blog/tags/prisma");
  await expect(prismaTagLink.first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/No posts found/i)).toHaveCount(0);
});
