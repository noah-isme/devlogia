import { expect, type Page } from "@playwright/test";

const NAV_TEST_ID = "admin-nav";
const NAV_TOGGLE_TEST_ID = "sidebar-toggle";
const ADMIN_ROUTE_PREFIX = "/admin/";

const toLinkTestId = (slug: string) => `nav-${slug}`;

const escapeRegExp = (value: string) =>
  value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");

export async function openAdminNavLink(page: Page, slug: string) {
  const targetUrl = `${ADMIN_ROUTE_PREFIX}${slug}`;
  const targetPattern = new RegExp(
    `${escapeRegExp(ADMIN_ROUTE_PREFIX)}${escapeRegExp(slug)}(?:[/?]|$)`
  );

  await page.waitForURL(/\/admin\//, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");

  const nav = page.getByTestId(NAV_TEST_ID);

  let navVisible = await nav.isVisible().catch(() => false);

  if (!navVisible) {
    const toggle = page.getByTestId(NAV_TOGGLE_TEST_ID);
    const toggleVisible = await toggle.isVisible().catch(() => false);

    if (toggleVisible) {
      await toggle.click();
      try {
        await expect(nav).toBeVisible({ timeout: 5_000 });
      } catch {
        // ignore — we'll fall back to navigating directly
      }
      navVisible = await nav.isVisible().catch(() => false);
    }
  }

  if (navVisible) {
    const linkTestId = toLinkTestId(slug);
    const linkByTestId = page.getByTestId(linkTestId);

    if (await linkByTestId.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL(targetPattern, { timeout: 10_000 }),
        linkByTestId.click(),
      ]);
      await page.waitForLoadState("networkidle");
      return;
    }

    const linkByHref = page.locator(`a[href$="/${slug}"]`).first();
    if (await linkByHref.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL(targetPattern, { timeout: 10_000 }),
        linkByHref.click(),
      ]);
      await page.waitForLoadState("networkidle");
      return;
    }
  }

  await page.goto(targetUrl);
  await page.waitForURL(targetPattern, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
}
