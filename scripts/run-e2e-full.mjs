#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabaseConnection } from "./check-db.mjs";

function runCommand(command, args = [], { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
  }

  const exitCode = result.status ?? (result.signal ? 1 : 0);
  if (exitCode !== 0 && !allowFailure) {
    process.exit(exitCode);
  }

  return exitCode;
}

async function main() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  process.chdir(path.resolve(currentDir, ".."));

  const dbUpExit = runCommand("pnpm", ["db:up"], { allowFailure: true });
  if (dbUpExit !== 0) {
    console.warn("⚠️  pnpm db:up did not complete successfully. Continuing with connection checks.");
  }

  const { ok, host, port } = await checkDatabaseConnection();
  if (!ok) {
    console.warn(
      "⚠️  PostgreSQL is unavailable. Skipping migrations, seeds, and Playwright suite. Start Docker with 'pnpm db:up' to enable the full E2E run.",
    );
    process.exit(0);
  }

  console.log(`✅ PostgreSQL is reachable at ${host}:${port}. Continuing with migrations and tests.`);

  runCommand("pnpm", ["db:reset"]);
  runCommand("pnpm", ["exec", "playwright", "install", "--with-deps"]);
  runCommand("pnpm", ["test:e2e"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
