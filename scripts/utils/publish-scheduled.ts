import { publishDueScheduledPosts } from "@/lib/cms/scheduled-publishing";

async function main() {
  const result = await publishDueScheduledPosts();
  console.log(`Published ${result.published} scheduled posts.`);
}

void main();
