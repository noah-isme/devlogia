import { expect, type Page } from "@playwright/test";

const NAV_TEST_ID = "admin-nav";
const NAV_TOGGLE_TEST_ID = "sidebar-toggle";

const toLinkTestId = (slug: string) => `nav-${slug}`;

export async function openAdminNavLink(page: Page, slug: string) {
  const toggle = page.getByTestId(NAV_TOGGLE_TEST_ID);
  if ((await toggle.count()) > 0 && (await toggle.isVisible())) {
    const expanded = await toggle.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await toggle.click();
    }
  }

  const nav = page.getByTestId(NAV_TEST_ID);
  await expect(nav).toBeVisible({ timeout: 10_000 });

  const linkTestId = toLinkTestId(slug);
  let link = page.getByTestId(linkTestId);

  if ((await link.count()) === 0) {
    link = page.locator(`a[href$="/${slug}"]`).first();
  }

  await link.waitFor({ state: "visible", timeout: 5_000 });
  await link.click();
}
