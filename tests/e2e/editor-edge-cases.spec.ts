import { expect, test } from "@playwright/test";

import {
  APP_BASE_URL,
  createPostViaApi,
  loginAsSuperadmin,
  loginAsWriter,
  uniquePostName,
} from "./helpers";

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test.describe("editor edge cases", () => {
  test.skip(!process.env.DATABASE_URL, "Requires database-backed editor flows");

  test("shows an error when media upload fails", async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.goto("/admin/posts/new");

    await page.route("**/api/uploadthing", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "forced upload failure" }),
      });
    });

    await page.getByLabel("Title").fill(uniquePostName("Upload Failure"));
    await page.getByLabel("Content").fill("Upload failure coverage.");

    await page.setInputFiles('input[type="file"]', {
      name: "broken-cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"),
    });

    await expect(page.getByText(/Gagal mengunggah media/i)).toBeVisible();
    await expect(page.getByLabel("Cover image URL")).toHaveValue("");
    await expect(page.getByLabel("Content")).toHaveValue(
      "Upload failure coverage.",
    );
  });

  test("restores the local draft after an autosave failure and reload", async ({
    page,
  }) => {
    await loginAsSuperadmin(page);
    await page.goto("/admin/posts/new");

    await page.route("**/api/admin/posts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "forced autosave failure" }),
        });
        return;
      }

      await route.continue();
    });

    const title = uniquePostName("Recovered Draft");
    const content = "Draft content that should survive a reload.";

    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Content").fill(content);

    await expect(
      page.getByText(/Tidak tersambung — versi lokal disimpan/i),
    ).toBeVisible();

    await page.reload();

    await expect(page.getByText(/Draf lokal ditemukan/i)).toBeVisible();
    await page.getByRole("button", { name: /Pulihkan draft/i }).click();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expect(page.getByLabel("Content")).toHaveValue(content);
  });

  test("writer cannot open another user's post editor", async ({
    page,
    browser,
  }) => {
    await loginAsSuperadmin(page);

    const title = uniquePostName("Writer Guard");
    const slug = `writer-guard-${Date.now()}`;
    const createdPost = await createPostViaApi(page, {
      title,
      slug,
      summary: "Writer ownership guard coverage.",
      contentMdx: "Writer should not be able to edit this post.",
    });

    const writerContext = await browser.newContext({
      baseURL: APP_BASE_URL,
    });
    const writerPage = await writerContext.newPage();

    try {
      await loginAsWriter(writerPage);

      const response = await writerPage.goto(`/admin/posts/${createdPost.id}`);
      expect(response?.status()).toBe(404);
      await expect(writerPage.getByLabel("Title")).toHaveCount(0);
      await expect(writerPage.getByRole("heading", { name: /edit post/i })).toHaveCount(0);
    } finally {
      await writerContext.close();
    }
  });
});
