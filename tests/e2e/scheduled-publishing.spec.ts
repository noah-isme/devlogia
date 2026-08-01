import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

test.describe("Scheduled publishing", () => {
  test("future scheduled post → worker run → public visibility → second worker idempotent", async ({ page, request }) => {
    await loginAsSuperadmin(page);

    // Create a post with future scheduled date
    await page.goto("/admin/posts/new");
    await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

    const timestamp = Date.now();
    const title = `Scheduled Post ${timestamp}`;
    const slug = `scheduled-post-${timestamp}`;
    const futureDate = new Date(Date.now() + 60000); // 1 minute in the future
    const scheduledAt = futureDate.toISOString().slice(0, 16); // Format for datetime-local input

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Summary").fill("Scheduled for future publication");
    await page.getByLabel("Content").fill("# Scheduled Post\n\nThis post should be published by the scheduled worker.");

    // Set status to SCHEDULED
    await page.getByLabel("Status").selectOption("SCHEDULED");
    
    // Set scheduled publish time
    await page.getByLabel("Publish at").fill(scheduledAt);

    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page.getByRole("button", { name: /update post/i })).toBeVisible();

    // Verify post is in SCHEDULED status
    await page.goto("/admin/posts");
    await expect(page.getByRole("cell", { name: slug })).toBeVisible();
    await expect(page.getByText("SCHEDULED")).toBeVisible();

    // Post should NOT be publicly accessible yet
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).not.toBeVisible({ timeout: 5000 });

    // Wait for scheduled time to pass
    await page.waitForTimeout(65000);

    // Trigger scheduled publishing worker via API
    const cronSecret = process.env.CRON_SECRET || "test-secret";
    const publishResponse = await request.post("/api/cron/publish-scheduled", {
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
      },
    });
    expect(publishResponse.ok()).toBeTruthy();
    const publishResult = await publishResponse.json();
    expect(publishResult.publishedCount).toBeGreaterThanOrEqual(1);

    // Post should now be publicly accessible
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("# Scheduled Post")).toBeVisible();

    // Verify status updated to PUBLISHED in admin
    await page.goto("/admin/posts");
    await expect(page.getByRole("cell", { name: slug })).toBeVisible();
    await expect(page.getByText("PUBLISHED")).toBeVisible();

    // Trigger worker again - should be idempotent (no duplicate)
    const secondResponse = await request.post("/api/cron/publish-scheduled", {
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
      },
    });
    expect(secondResponse.ok()).toBeTruthy();
    const secondResult = await secondResponse.json();
    expect(secondResult.publishedCount).toBe(0); // No new posts to publish

    // Post should still be accessible (not duplicated)
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });
});