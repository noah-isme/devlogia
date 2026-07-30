import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function verifyCoverMatching() {
  console.log("📸 Verifying matching cover images on Homepage & Article Detail page...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Homepage Featured Articles
    await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "homepage_matching_covers.png") });
    console.log("  Saved: homepage_matching_covers.png");

    // 2. Article Detail Page
    await page.goto("http://localhost:3001/blog/future-of-ai-native-software-engineering", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "article_detail_matching_cover.png") });
    console.log("  Saved: article_detail_matching_cover.png");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

verifyCoverMatching();
