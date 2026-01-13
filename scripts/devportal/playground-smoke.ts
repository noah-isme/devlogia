export {};

async function main() {
  const sandboxKey = process.env.DEVPORTAL_SANDBOX_API_KEY;
  if (!sandboxKey) {
    console.warn("DEVPORTAL_SANDBOX_API_KEY is not set. The playground will require manual headers.");
  }

  const rateLimit = process.env.DEVPORTAL_RATE_LIMIT_RPM ?? "120";
  console.log(`Sandbox key: ${sandboxKey ? "configured" : "missing"}`);
  console.log(`Rate limit (requests/min): ${rateLimit}`);
}

void main().catch((error) => {
  console.error("Playground smoke test failed", error);
  process.exitCode = 1;
});
