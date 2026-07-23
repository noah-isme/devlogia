import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function captureRestoredLayout() {
  console.log("📸 Capturing restored Admin Console layout...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("admin@devlogia.test");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    await page.goto("http://localhost:3000/admin/posts", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const filePath = path.join(ARTIFACT_DIR, "restored_admin_posts_clean.png");
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`✅ Saved screenshot: ${filePath}`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

captureRestoredLayout();
