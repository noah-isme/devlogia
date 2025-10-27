import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const NEW_POST_URL = "/admin/posts/new";
const NEW_POST_URL_PATTERN = /\/admin\/posts\/new(?:[/?]|$)/;

async function clickIfVisible(page: Page, locator: Locator) {
  const isVisible = await locator.isVisible().catch(() => false);

  if (!isVisible) {
    return false;
  }

  try {
    await Promise.all([
      page.waitForURL(NEW_POST_URL_PATTERN, { timeout: 10_000 }),
      locator.click(),
    ]);
    await page.waitForLoadState("networkidle");
    return true;
  } catch {
    return false;
  }
}

export async function openNewPost(page: Page) {
  await page.waitForLoadState("domcontentloaded");

  if (await clickIfVisible(page, page.getByTestId("new-post"))) {
    await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 10_000 });
    return;
  }

  if (
    await clickIfVisible(
      page,
      page.locator('a[href="/admin/posts/new"]').first()
    )
  ) {
    await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 10_000 });
    return;
  }

  const fuzzyLabel = /new\s*post|new|create/i;

  if (
    await clickIfVisible(
      page,
      page.getByRole("link", { name: fuzzyLabel }).first()
    )
  ) {
    await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 10_000 });
    return;
  }

  if (
    await clickIfVisible(
      page,
      page.getByRole("button", { name: fuzzyLabel }).first()
    )
  ) {
    await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 10_000 });
    return;
  }

  await page.goto(NEW_POST_URL);
  await page.waitForURL(NEW_POST_URL_PATTERN, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 10_000 });
}
