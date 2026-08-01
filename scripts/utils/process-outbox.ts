import { processOutboxEvents } from "@/lib/cms/scheduled-publishing";

async function main() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting outbox event processor...`);
  try {
    const result = await processOutboxEvents({ batchSize: 100 });
    console.log(`[${new Date().toISOString()}] Done. Processed outbox events.`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running outbox processor:`, error);
    process.exit(1);
  }
}

void main();