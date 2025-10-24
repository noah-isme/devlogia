import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@devlogia.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("admin can upload media and publish with OG", async ({ page, request }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.getByRole("link", { name: "Posts" }).click();
  await page.getByRole("link", { name: /new post/i }).click();
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const title = `Media Test ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Testing media upload via Playwright");
  await page.getByLabel("Content").fill("# Media Upload\n\nThis post verifies cover uploads and OG images.");

  await page.setInputFiles('input[type="file"]', {
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"),
  });

  await expect(page.getByText(/Cover diperbarui/i)).toBeVisible();
  await expect(page.getByLabel("Cover image URL")).toHaveValue(/\/uploads\//);

  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.waitForTimeout(3000);

  const slug = await page.getByLabel("Slug").inputValue();

  await page.goto(`/blog/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const ogResponse = await request.get(`/api/og?slug=${slug}&title=${encodeURIComponent(title)}`);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
});
