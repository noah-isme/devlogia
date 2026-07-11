#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabaseConnection } from "../database/check-db.mjs";

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

function escapeMySqlIdentifier(identifier) {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

function ensureMysqlDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return;
  }

  if (!parsed.protocol.startsWith("mysql")) {
    return;
  }

  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    return;
  }

  const user = decodeURIComponent(parsed.username || "root");
  const password = decodeURIComponent(parsed.password || "root");
  const sql = `CREATE DATABASE IF NOT EXISTS ${escapeMySqlIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

  runCommand("docker", [
    "compose",
    "exec",
    "-T",
    "mysql",
    "mysql",
    "-u",
    user,
    `-p${password}`,
    "-e",
    sql,
  ]);
}

async function main() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  process.chdir(path.resolve(currentDir, "..", ".."));

  if (!process.env.CI && existsSync(".env.test")) {
    process.loadEnvFile?.(".env.test");
  }

  const dbUpExit = runCommand("pnpm", ["db:up"], { allowFailure: true });
  if (dbUpExit !== 0) {
    console.warn(
      "⚠️  pnpm db:up did not complete successfully. Continuing with connection checks.",
    );
  }

  const { ok, host, port } = await checkDatabaseConnection();
  if (!ok) {
    console.warn(
      "⚠️  PostgreSQL is unavailable. Skipping migrations, seeds, and Playwright suite. Start Docker with 'pnpm db:up' to enable the full E2E run.",
    );
    process.exit(0);
  }

  console.log(
    `✅ Database is reachable at ${host}:${port}. Continuing with migrations and tests.`,
  );

  ensureMysqlDatabase();
  runCommand("pnpm", ["db:reset"]);
  if (process.env.PLAYWRIGHT_INSTALL_DEPS === "1") {
    runCommand("pnpm", ["exec", "playwright", "install", "--with-deps"]);
  } else if (process.env.PLAYWRIGHT_INSTALL_BROWSERS === "1") {
    runCommand("pnpm", ["exec", "playwright", "install"]);
  }
  runCommand("pnpm", ["test:e2e"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
