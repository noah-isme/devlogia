import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner123!";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("publishing records audit log entry", async ({ page }) => {
  await loginAs(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });

  await expect(page).toHaveURL(/admin\/dashboard/);

  await page.getByRole("link", { name: "Posts" }).click();
  await page.getByRole("link", { name: /new post/i }).click();
  await expect(page.getByRole("heading", { name: /create a new post/i })).toBeVisible();

  const title = `Webhook Publish ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Verifying publish audit log");
  await page.getByLabel("Content").fill("# Webhook\n\nTrigger outbound webhooks via audit log test.");

  await page.getByRole("button", { name: /^publish$/i }).click();
  await page.waitForTimeout(2000);

  const slug = await page.getByLabel("Slug").inputValue();
  expect(slug).not.toEqual("");

  const log = await prisma.auditLog.findFirst({
    where: {
      action: "post:publish",
      meta: {
        path: ["slug"],
        equals: slug,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  expect(log).not.toBeNull();
});
