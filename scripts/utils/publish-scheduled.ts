import { publishDueScheduledPosts } from "@/lib/cms/scheduled-publishing";

async function main() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting scheduled post publishing worker...`);
  try {
    const result = await publishDueScheduledPosts();
    console.log(`[${new Date().toISOString()}] Done. Published ${result.published} scheduled posts.`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running scheduled publishing worker:`, error);
    process.exit(1);
  }
}

void main();
