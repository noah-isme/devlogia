import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "/home/noah/.gemini/antigravity-cli/brain/6f1fbaa7-2284-4aca-bc31-912c09e5a072/admin_screenshots";

async function verifyFixedSidebarPattern() {
  console.log("🔍 Testing fixed inset-y-0 left-0 sidebar pattern on /admin/posts...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3001/admin/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("admin@devlogia.test");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    await page.goto("http://localhost:3001/admin/posts", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const initialPos = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const main = document.querySelector("main");
      const aBox = aside ? aside.getBoundingClientRect() : null;
      const mBox = main ? main.getBoundingClientRect() : null;
      return { aside: aBox, main: mBox, scrollY: window.scrollY };
    });

    console.log("Top View (scrollY = 0px):");
    console.log(`  Fixed Sidebar: Left=${Math.round(initialPos.aside.left)}px, Top=${Math.round(initialPos.aside.top)}px, Bottom=${Math.round(initialPos.aside.bottom)}px, Width=${Math.round(initialPos.aside.width)}px`);
    console.log(`  Main Content: Left=${Math.round(initialPos.main.left)}px, Top=${Math.round(initialPos.main.top)}px`);

    // Scroll down 1200px
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);

    const scrolledPos = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const main = document.querySelector("main");
      const aBox = aside ? aside.getBoundingClientRect() : null;
      const mBox = main ? main.getBoundingClientRect() : null;
      return { aside: aBox, main: mBox, scrollY: window.scrollY };
    });

    console.log("\nScrolled View (window.scrollY = 1200px):");
    console.log(`  Fixed Sidebar: Left=${Math.round(scrolledPos.aside.left)}px, Top=${Math.round(scrolledPos.aside.top)}px, Bottom=${Math.round(scrolledPos.aside.bottom)}px, Width=${Math.round(scrolledPos.aside.width)}px`);
    console.log(`  Main Content: Left=${Math.round(scrolledPos.main.left)}px, Top=${Math.round(scrolledPos.main.top)}px`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "posts_page_fixed_inset_y_sidebar.png") });

    if (scrolledPos.aside.top === 0 && scrolledPos.aside.left === 0 && scrolledPos.aside.bottom === 900) {
      console.log("\n✅ PERFECT MATCH: Sidebar is 100% FIXED INSET-Y-0 LEFT-0 (Left: 0px, Top: 0px, Height: 900px)! It stays completely locked on the left edge while main content scrolls!");
    } else {
      console.log(`\n⚠️ Position: Top=${scrolledPos.aside.top}, Left=${scrolledPos.aside.left}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

verifyFixedSidebarPattern();
