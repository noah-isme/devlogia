import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { loginAsSuperadmin } from "./auth-helper";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("publishing records audit log entry", async ({ page }) => {
  await loginAsSuperadmin(page);

  await page.goto("/admin/posts/new");
  await page.waitForURL(/admin\/posts\/new/);

  const title = `Webhook Publish ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Summary").fill("Verifying publish audit log");
  await page.getByLabel("Content").fill("# Webhook\n\nTrigger outbound webhooks via audit log test.");

  await page.getByRole("button", { name: /^publish$/i }).click();
  await expect(page.getByRole("button", { name: /update post/i })).toBeVisible();
  await expect(page.getByText(/Terakhir disimpan/i)).toBeVisible();
  // Wait for any pending network requests to settle before reading the slug
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  const slug = await page.getByLabel("Slug").inputValue();
  expect(slug).not.toEqual("");

  // Wait a moment to ensure the audit log is committed to the remote DB
  await page.waitForTimeout(1000);

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "post:publish",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const matchingLog = logs.find((l) => {
    const meta = l.meta;
    if (meta === null || meta === undefined) return false;
    if (typeof meta === "object" && !Array.isArray(meta)) {
      return (meta as Record<string, unknown>)["slug"] === slug;
    }
    if (typeof meta === "string") {
      try {
        const parsed = JSON.parse(meta) as Record<string, unknown>;
        return parsed["slug"] === slug;
      } catch {
        return false;
      }
    }
    return false;
  });
  expect(matchingLog, `Expected audit log with slug="${slug}" in ${JSON.stringify(logs.map((l) => l.meta))}`).toBeDefined();
});
