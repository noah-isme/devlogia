import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./helpers";

test.describe("Middleware Authentication", () => {
  test("unauthenticated user is redirected from /admin/dashboard to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("unauthenticated user is redirected from /admin/posts to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin/posts");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("unauthenticated user is redirected from /admin/users to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("unauthenticated API request to /api/admin returns 401", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/users");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("login page is accessible without authentication", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("public routes are accessible without authentication", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/admin\/login/);
  });

  test("authenticated user can access admin dashboard", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL,
      "Requires database for authentication",
    );

    const email = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
    const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("redirect preserves original URL in callbackUrl", async ({ page }) => {
    await page.goto("/admin/posts/new");
    await expect(page).toHaveURL(/\/admin\/login.*callbackUrl/);
  });

  test("expired session is redirected back to login with callbackUrl", async ({
    page,
  }) => {
    test.skip(
      !process.env.DATABASE_URL,
      "Requires database for authentication",
    );

    await loginAsSuperadmin(page);
    await page.context().clearCookies();

    await page.goto("/admin/posts/new");

    await expect(page).toHaveURL(/\/admin\/login.*callbackUrl=/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });
});
