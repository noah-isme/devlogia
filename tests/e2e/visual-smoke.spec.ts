import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { createPostViaApi, loginAsSuperadmin, uniquePostName } from "./helpers";

type PagePayload = {
  readonly title: string;
  readonly slug: string;
  readonly contentMdx: string;
  readonly published: boolean;
};

type CreatedPage = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
};

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function createPageViaApi(page: Page, payload: PagePayload) {
  const result = await page.evaluate(async (pagePayload) => {
    const response = await fetch("/api/admin/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(pagePayload),
    });

    const body = (await response.json().catch(() => null)) as {
      page?: Partial<CreatedPage>;
      error?: string;
    } | null;

    return {
      status: response.status,
      body,
    };
  }, payload);

  expect(result.status).toBe(201);
  expect(result.body?.page?.id).toBeTruthy();
  expect(result.body?.page?.slug).toBeTruthy();

  const createdPage = result.body?.page;
  if (!createdPage?.id || !createdPage.slug || !createdPage.title) {
    throw new Error("Page creation response did not include id, slug, and title.");
  }

  return createdPage;
}

test("visual smoke screenshots", async ({ page }, testInfo) => {
  const fixtureSuffix = Date.now();
  const postTitle = uniquePostName("Visual Smoke Post");
  const postSlug = `visual-smoke-post-${fixtureSuffix}`;
  const pageTitle = `Visual Smoke Page ${fixtureSuffix}`;
  const pageSlug = `visual-smoke-page-${fixtureSuffix}`;

  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await attachScreenshot(page, testInfo, "admin-login");

  await loginAsSuperadmin(page);
  await expect(page).not.toHaveURL(/email=|password=/);
  await expect(page.getByRole("heading", { name: /content health/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-dashboard");

  const createdPost = await createPostViaApi(page, {
    title: postTitle,
    slug: postSlug,
    summary: "A deterministic post fixture for visual smoke coverage.",
    contentMdx: `# ${postTitle}\n\nThis published post keeps the visual smoke blog detail route deterministic.`,
    status: "PUBLISHED",
  });

  const createdPage = await createPageViaApi(page, {
    title: pageTitle,
    slug: pageSlug,
    contentMdx: `# ${pageTitle}\n\nThis published page keeps the visual smoke static page route deterministic.`,
    published: true,
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /publish smarter/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "landing");

  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: /deep writing/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Older" })).toBeVisible();
  await attachScreenshot(page, testInfo, "blog-index");

  await page.goto(`/blog/${createdPost.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: postTitle }).first()).toBeVisible();
  await attachScreenshot(page, testInfo, "blog-detail");

  await page.goto("/subscribe");
  await expect(page.getByRole("heading", { name: /stay in the loop/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "subscribe");

  await page.goto(`/${createdPage.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: pageTitle }).first()).toBeVisible();
  await attachScreenshot(page, testInfo, "static-page");

  await page.goto("/admin/posts");
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-posts-list");

  await page.goto(`/admin/posts/${createdPost.id}`);
  await expect(page.getByLabel("Title")).toHaveValue(postTitle);
  await attachScreenshot(page, testInfo, "admin-post-edit");

  await page.goto("/admin/posts/new");
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "post-editor-new");

  await page.goto("/admin/pages");
  await expect(page.getByRole("heading", { name: "Pages" }).first()).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-pages");

  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: /team roles/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-users");

  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { name: /media library/i })).toBeVisible();
  await expect(page.getByLabel("Search media")).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-media");

  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: /analytics overview/i })).toBeVisible();
  await expect(page.getByTestId("analytics-dashboard").or(page.getByTestId("analytics-error"))).toBeVisible();
  await attachScreenshot(page, testInfo, "admin-analytics");
});
