import { expect, type Page } from "@playwright/test";

const NAV_TEST_ID = "admin-nav";
const NAV_TOGGLE_TEST_ID = "admin-nav-toggle";

const toLinkTestId = (slug: string) => `admin-nav-${slug}`;

export async function openAdminNavLink(page: Page, slug: string) {
  const nav = page.getByTestId(NAV_TEST_ID);
  await expect(nav).toBeVisible({ timeout: 10_000 });

  const toggle = page.getByTestId(NAV_TOGGLE_TEST_ID);
  if ((await toggle.count()) > 0) {
    const isNavVisible = await nav.isVisible();
    if (!isNavVisible) {
      await toggle.click();
      await expect(nav).toBeVisible({ timeout: 5_000 });
    }
  }

  const linkTestId = toLinkTestId(slug);
  const link = page.getByTestId(linkTestId);
  await expect(link).toBeVisible({ timeout: 5_000 });
  await link.click();
}
