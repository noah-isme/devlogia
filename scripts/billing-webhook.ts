import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const blocking = readiness.filter((issue) => issue.level === "error");

  if (blocking.length > 0) {
    console.error("❌ Billing webhook tooling cannot run:");
    for (const issue of blocking) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (config.billing.provider !== "stripe") {
    console.error("❌ Billing webhook helper currently supports only Stripe integrations.");
    process.exitCode = 1;
    return;
  }

  const secret = config.billing.stripeWebhookSecret;
  if (!secret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is required to generate signatures.");
    process.exitCode = 1;
    return;
  }

  const source = process.argv[2];
  const payload = source && source !== "-" ? await readFile(resolve(process.cwd(), source), "utf8") : await readStdin();

  if (!payload) {
    console.error("❌ Provide a JSON payload via file path or STDIN.");
    process.exitCode = 1;
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const header = `t=${timestamp},v1=${signature}`;

  const verifyArg = process.argv.find((value) => value.startsWith("--verify="));
  if (verifyArg) {
    const target = verifyArg.slice("--verify=".length).trim();
    if (target.length === 0) {
      console.error("⚠️  --verify flag provided without a signature to compare.");
    } else if (target === signature) {
      console.log("✅ Provided signature matches the generated value.");
    } else {
      console.warn("⚠️  Provided signature does not match generated signature.");
    }
  }

  console.log("Stripe-Signature header:");
  console.log(header);
}

main().catch((error) => {
  console.error("Failed to generate Stripe webhook signature", error);
  process.exitCode = 1;
});
