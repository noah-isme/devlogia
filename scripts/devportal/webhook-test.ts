export {};

async function main() {
  if (!process.env.WEBHOOK_SIGNING_KEY) {
    console.warn("WEBHOOK_SIGNING_KEY is not configured. Webhook tester will reject requests.");
  } else {
    console.log("Webhook signing key detected.");
  }

  const ttl = process.env.WEBHOOK_REPLAY_TTL_SEC ?? "300";
  console.log(`Replay TTL (seconds): ${ttl}`);
}

void main().catch((error) => {
  console.error("Webhook tester check failed", error);
  process.exitCode = 1;
});
