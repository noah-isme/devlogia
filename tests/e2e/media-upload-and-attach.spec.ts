import { expect, test } from "@playwright/test";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("admin can upload media and publish with OG", async ({ page, request }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SUPERADMIN_EMAIL);
  await page.getByLabel("Password").fill(SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const timestamp = Date.now();
  const title = `Media Test ${timestamp}`;
  const slug = `media-test-${timestamp}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Summary").fill("Testing media upload via Playwright");
  await page.getByLabel("Content").fill("# Media Upload\n\nThis post verifies cover uploads and OG images.");

  await page.setInputFiles('input[type="file"]', {
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"),
  });

  await expect(page.getByText(/Cover diperbarui/i)).toBeVisible();
  await expect(page.getByLabel("Cover image URL")).toHaveValue(/\/uploads\//);
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByRole("button", { name: /update post/i })).toBeVisible();
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();

  await page.goto(`/blog/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const ogResponse = await request.get(`/api/og?slug=${slug}&title=${encodeURIComponent(title)}`);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
});
