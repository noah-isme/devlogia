import { settlePendingPayouts } from "../src/lib/billing/payouts";

async function main() {
  const limit = Number.parseInt(process.argv[2] ?? "20", 10);
  const result = await settlePendingPayouts(Number.isFinite(limit) ? limit : 20);
  console.log(`Settled ${result.processed} payout(s).`);
}

main().catch((error) => {
  console.error("Failed to settle payouts", error);
  process.exitCode = 1;
});
