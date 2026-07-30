import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function testScrollStickySidebar() {
  console.log("Testing sticky sidebar on scroll down...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3001/admin/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("noorwahid052002@gmail.com");
    await page.getByLabel("Password").fill("Noorwahid313717!@#$%");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Go to long page (New Post Editor)
    await page.goto("http://localhost:3001/admin/posts/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Capture top view
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sticky_sidebar_top.png") });

    // Scroll down 600px
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);

    // Capture scrolled-down view showing sticky sidebar pinned to top
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sticky_sidebar_scrolled_down.png") });

    console.log("✅ Saved sticky_sidebar_top.png and sticky_sidebar_scrolled_down.png!");
  } catch (err) {
    console.error("Scroll test error:", err);
  } finally {
    await browser.close();
  }
}

testScrollStickySidebar();
