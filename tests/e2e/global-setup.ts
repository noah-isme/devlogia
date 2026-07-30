/**
 * Global setup: pre-authenticates both test users and saves their browser
 * session state to disk so that individual specs can reuse the session without
 * going through the login form on every test.
 *
 * If the server is not yet reachable (e.g. cold start) the setup gracefully
 * skips writing the state files. Individual specs fall back to fresh logins
 * via auth-helper.ts.
 *
 * Stored state files:
 *   tests/e2e/.auth/superadmin.json
 *   tests/e2e/.auth/writer.json
 */

import { mkdirSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  // Ensure the .auth directory exists
  try {
    mkdirSync("tests/e2e/.auth", { recursive: true });
  } catch {
    // already exists
  }

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:3001";

  const superadminEmail =
    process.env.SEED_SUPERADMIN_EMAIL ?? "owner@devlogia.test";
  const superadminPassword =
    process.env.SEED_SUPERADMIN_PASSWORD ?? "owner123";
  const writerEmail =
    process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
  const writerPassword = process.env.SEED_WRITER_PASSWORD ?? "writer123";

  const browser = await chromium.launch();

  async function saveAuth(
    email: string,
    password: string,
    storagePath: string,
  ) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await page.goto("/admin/login", { timeout: 15_000 });
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 });
      await context.storageState({ path: storagePath });
      console.log(`[globalSetup] saved auth state for ${email} → ${storagePath}`);
    } catch (err) {
      console.warn(
        `[globalSetup] could not pre-authenticate ${email}: ${(err as Error).message}\n` +
        `  Tests will fall back to fresh logins.`,
      );
    } finally {
      await context.close();
    }
  }

  await saveAuth(
    superadminEmail,
    superadminPassword,
    "tests/e2e/.auth/superadmin.json",
  );
  await saveAuth(writerEmail, writerPassword, "tests/e2e/.auth/writer.json");

  await browser.close();
}

export default globalSetup;
