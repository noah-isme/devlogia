import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function verifyJournalCovers() {
  console.log("📸 Verifying cover images on Journal page (/blog)...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const filePath = path.join(ARTIFACT_DIR, "journal_page_matching_covers.png");
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`✅ Saved screenshot: ${filePath}`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

verifyJournalCovers();
