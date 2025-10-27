import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";
import { openNewPost } from "./utils/admin";
import { openAdminNavLink } from "./utils/navigation";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner123!";

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("admin can upload media and publish with OG", async ({ page, request }) => {
  await loginAs(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);

  await openAdminNavLink(page, "posts");
  await openNewPost(page);
  await expect(page).toHaveURL(/admin\/posts\/new/);
  await expect(page.getByTestId("post-editor")).toBeVisible();
  await expect(page.getByTestId("post-editor-heading")).toBeVisible();

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
