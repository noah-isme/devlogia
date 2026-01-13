import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

test("complete post lifecycle: create, edit, publish, delete", async ({ page }) => {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Create Post
    await page.getByRole("link", { name: "Posts" }).click();
    await page.getByRole("link", { name: /new post/i }).click();

    const timestamp = Date.now();
    const title = `Lifecycle Post ${timestamp}`;
    const slug = `lifecycle-post-${timestamp}`;

    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Summary").fill("Lifecycle test summary");

    // Wait for autosave or minimal delay
    await page.waitForTimeout(1000);

    // Add Tags
    await page.getByLabel("Tags").fill("e2e, testing");
    await page.getByLabel("Tags").blur();

    // Save Draft
    await page.getByRole("button", { name: /save draft/i }).click();
    // Expect "Terakhir disimpan" or similar confirmation, assuming autosave state changes
    // Editor.tsx text: "Terakhir disimpan pukul ..."
    await expect(page.getByText(/terakhir disimpan/i)).toBeVisible();

    // Reload to verify persistence
    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expect(page.getByLabel("Tags")).toHaveValue("e2e, testing");

    // Edit Content & Publish
    await page.getByLabel("Content").fill("# Updated Content\n\nVerified by Playwright.");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: /publish/i }).click();

    await page.waitForTimeout(1000); // Allow save

    // Verify Public Access
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Delete Post
    await page.goto("/admin/posts");
    await page.getByRole("link", { name: title }).click();

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    await page.getByRole("button", { name: /delete/i }).click();

    // Verify Redirect
    await expect(page).toHaveURL(/\/admin\/posts/);

    // Verify Absence
    // It might still be in the list if we don't reload or if validation is fast, but it should be gone.
    // We can search or just look for the text.
    await expect(page.getByRole("link", { name: title })).not.toBeVisible();
});
