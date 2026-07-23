import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function verifyFeatures() {
  console.log("📸 Verifying Command Palette & Interactive Code Block Sandbox...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Command Palette Trigger & Modal Open
    await page.goto("http://localhost:3000/blog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Trigger Command Palette via keyboard shortcut (Meta+K / Control+K)
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "command_palette_modal.png") });
    console.log("  Saved: command_palette_modal.png");

    // Perform live search inside Command Palette
    await page.keyboard.type("Prisma");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "command_palette_live_search.png") });
    console.log("  Saved: command_palette_live_search.png");

    // Press Escape to close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // 2. Interactive Code Block & Execution Sandbox
    await page.goto("http://localhost:3000/blog/autonomous-agentic-coding-architecture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Scroll to code snippet and click "▶ Run Code"
    const runBtn = page.locator('button:has-text("▶ Run Code")').first();
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "interactive_code_block_sandbox.png") });
    console.log("  Saved: interactive_code_block_sandbox.png");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

verifyFeatures();
