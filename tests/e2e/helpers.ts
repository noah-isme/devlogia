import { existsSync, readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const APP_BASE_URL = "http://127.0.0.1:3000";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";
const WRITER_EMAIL = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
const WRITER_PASSWORD = process.env.SEED_WRITER_PASSWORD ?? "writer123";

type Credentials = {
  email: string;
  password: string;
};

type PostPayload = {
  title: string;
  slug: string;
  summary: string;
  contentMdx: string;
  status?: "DRAFT" | "PUBLISHED";
};

export function uniquePostName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

export async function loginAs(page: Page, credentials: Credentials) {
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

export async function loginAsSuperadmin(page: Page) {
  await loginAs(page, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
}

export async function loginAsWriter(page: Page) {
  await loginAs(page, {
    email: WRITER_EMAIL,
    password: WRITER_PASSWORD,
  });
}

export async function createPostViaApi(page: Page, payload: PostPayload) {
  const result = await page.evaluate(async (postPayload) => {
    const response = await fetch("/api/admin/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ...postPayload,
        status: postPayload.status ?? "DRAFT",
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      post?: { id?: string; slug?: string; title?: string };
      error?: string;
    } | null;

    return {
      status: response.status,
      body,
    };
  }, payload);

  expect(result.status).toBe(201);
  expect(result.body?.post?.id).toBeTruthy();

  return result.body!.post!;
}
