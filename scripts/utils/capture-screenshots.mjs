import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/screenshots";
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const pagesToCapture = [
    { url: "http://localhost:3001/", filename: "01_landing_page.png" },
    { url: "http://localhost:3001/blog", filename: "02_blog_journal_index.png" },
    { url: "http://localhost:3001/blog/autonomous-agentic-coding-architecture", filename: "03_article_detail_comments_reactions.png" },
    { url: "http://localhost:3001/blog/saved", filename: "04_saved_articles_reading_list.png" },
    { url: "http://localhost:3001/admin/login", filename: "05_admin_login.png" },
  ];

  console.log("Capturing page screenshots...");

  for (const item of pagesToCapture) {
    try {
      console.log(`Navigating to ${item.url}...`);
      await page.goto(item.url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);
      const filePath = path.join(ARTIFACT_DIR, item.filename);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot: ${filePath}`);
    } catch (err) {
      console.error(`Failed to capture ${item.url}`, err.message);
    }
  }

  await browser.close();
}

capture();
