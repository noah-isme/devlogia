import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("static page lifecycle", async ({ page }) => {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/admin\/dashboard/);

    // Go to Pages
    // We'll navigate directly as sidebar coverage isn't guaranteed in this snippet
    await page.goto("/admin/pages");

    // Create
    await page.getByRole("button", { name: /new page/i }).click();

    // "New page" should appear in the list. PageManager sorts by title. 
    // It might select the first one or the ID.
    // We assume the new page is selected or at the bottom.
    // The toast says "Page created".
    await expect(page.getByText("Page created")).toBeVisible();

    const title = `About Us ${Date.now()}`;
    const slug = `about-${Date.now()}`;

    // Fill Editor Form (Right side)
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Content").fill("# About Us\n\nThis is a static page.");

    // Publish
    await page.getByLabel("Published").check();

    // Save
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Page saved")).toBeVisible();

    // Reload to verify persistence
    await page.reload();

    // We need to select the page again from the list on the left to edit/verify it.
    // The list button contains the title.
    await page.getByRole("button", { name: title }).click();

    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expect(page.getByLabel("Slug")).toHaveValue(slug);
    await expect(page.getByLabel("Published")).toBeChecked();

    // Delete
    // Ensure "Delete" button is visible in the editor header
    await page.getByRole("button", { name: /delete/i }).click();

    // Toast confirmation
    await expect(page.getByText("Page deleted")).toBeVisible();

    // Verify absence in list
    await expect(page.getByRole("button", { name: title })).not.toBeVisible();
});
