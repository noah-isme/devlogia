import { spawn } from "node:child_process";
import process from "node:process";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_APP_URL",
  "SENTRY_DSN",
  "LOGTAIL_TOKEN",
  "RATE_LIMIT_REDIS_URL",
];

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !(process.env[key] && process.env[key]?.trim()));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

async function main() {
  validateEnv();
  console.log("[deploy:staging] Environment validated");

  console.log("[deploy:staging] Running lint");
  await run("pnpm", ["lint"]);

  console.log("[deploy:staging] Running unit tests");
  await run("pnpm", ["test"]);

  console.log("[deploy:staging] Building application");
  await run("pnpm", ["build"]);

  console.log("[deploy:staging] Validating OpenAPI schema");
  await run("pnpm", ["openapi:validate"]);

  console.log("[deploy:staging] Capturing pre-deploy database snapshot");
  await run("pnpm", ["db:backup", "--out", "backups/staging"]);

  console.log("[deploy:staging] Running smoke tests");
  await run("pnpm", ["test:e2e"]);

  console.log("[deploy:staging] Deployment package ready. Use your platform CLI to push to staging.");
  console.log("[deploy:staging] After deploy, hit /api/_version and /api/health to confirm.");
}

main().catch((error) => {
  console.error(`[deploy:staging] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
