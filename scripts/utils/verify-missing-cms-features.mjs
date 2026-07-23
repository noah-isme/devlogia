import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function verifyMissingCmsFeatures() {
  console.log("📸 Capturing new CMS & Admin features...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // Login
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', "owner@devlogia.test");
    await page.fill('input[name="password"]', "owner123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // 1. Admin Settings Backup Button
    await page.goto("http://localhost:3000/admin/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin_settings_backup_export.png") });
    console.log("  Saved: admin_settings_backup_export.png");

    // 2. Editor Scheduled Datetime & Share Preview
    await page.goto("http://localhost:3000/admin/posts/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const select = page.locator('select[name="status"]');
    if (await select.isVisible()) {
      await select.selectOption("SCHEDULED");
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "editor_scheduled_datetime_picker.png") });
    console.log("  Saved: editor_scheduled_datetime_picker.png");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

verifyMissingCmsFeatures();
