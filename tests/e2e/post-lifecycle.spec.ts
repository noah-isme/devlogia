import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test("complete post lifecycle: create, edit, publish, delete", async ({ page }) => {
    await loginAsSuperadmin(page);

    // Create Post
    await page.goto("/admin/posts/new");

    const timestamp = Date.now();
    const title = `Lifecycle Post ${timestamp}`;
    const slug = `lifecycle-post-${timestamp}`;

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Summary").fill("Lifecycle test summary");

    // Wait for autosave or minimal delay
    await page.waitForTimeout(1000);

    // Add Tags
    await page.getByLabel("Tags").fill("e2e, testing");
    await page.getByLabel("Tags").blur();

    // Save Draft via autosave
    await expect(page.getByText(/terakhir disimpan/i)).toBeVisible();

    // Open the persisted post from the list to verify it was saved server-side.
    await page.goto("/admin/posts?limit=30");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
    await expect(page.getByLabel("Tags")).toHaveValue("e2e, testing");

    // Edit Content & Publish
    await page.getByRole("button", { name: /publish/i }).click();
    await expect(page.getByRole("button", { name: /update post/i })).toBeVisible();
    await expect(page.getByText(/terakhir disimpan/i)).toBeVisible();

    // Verify Public Access
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Delete Post
    await page.goto("/admin/posts?limit=30");
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
