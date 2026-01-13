import { spawn } from "node:child_process";
import { access, constants, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import path from "node:path";

function ensureDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for restore");
  }
  return new URL(url);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let file: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if ((value === "--file" || value === "-f") && args[index + 1]) {
      file = args[index + 1];
      index += 1;
    }
  }

  if (!file) {
    throw new Error("--file <path> is required for restore");
  }

  return path.resolve(process.cwd(), file);
}

async function run() {
  const filePath = parseArgs();
  await new Promise<void>((resolve, reject) => {
    access(filePath, constants.R_OK, (error) => {
      if (error) {
        reject(new Error(`Backup file not readable: ${filePath}`));
      } else {
        resolve();
      }
    });
  });

  const dbUrl = ensureDatabaseUrl();
  const database = dbUrl.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const env = { ...process.env };
  if (dbUrl.password) {
    env.MYSQL_PWD = decodeURIComponent(dbUrl.password);
  }

  const restore = spawn(
    "mysql",
    [`-h${dbUrl.hostname}`, `-P${dbUrl.port || "3306"}`, `-u${decodeURIComponent(dbUrl.username)}`, database],
    { env, stdio: ["pipe", "inherit", "inherit"] },
  );

  const inputStream = createReadStream(filePath);
  const gunzip = filePath.endsWith(".gz") ? createGunzip() : null;

  if (gunzip) {
    await pipeline(inputStream, gunzip, restore.stdin);
  } else {
    await pipeline(inputStream, restore.stdin);
  }

  const exitCode: number = await new Promise((resolve) => {
    restore.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`mysql exited with code ${exitCode}`);
  }

  console.log(`Restore complete from ${filePath}`);
}

run().catch((error) => {
  console.error(`[db:restore] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
