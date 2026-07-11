import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

function loadLocalEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  for (const file of [".env.test", ".env"]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on("error", reject);
  });
}

async function main() {
  loadLocalEnv();

  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  console.log("\n🗄️  Resetting database via Prisma migrations...");
  await run(pnpm, ["prisma", "migrate", "reset", "--force", "--skip-generate"]);

  console.log("\n🌱 Reseeding deterministic fixtures...");
  await run(pnpm, ["prisma:seed"]);

  console.log("\n✅ Database reset complete.");
}

main().catch((error) => {
  console.error("Database reset failed", error);
  process.exit(1);
});
