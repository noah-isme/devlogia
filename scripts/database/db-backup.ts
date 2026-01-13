import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

function ensureDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run a backup");
  }
  return new URL(url);
}

function resolveOutputPath(dir: string | undefined) {
  const targetDir = dir ? path.resolve(process.cwd(), dir) : path.join(process.cwd(), "backups");
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
  const filename = `devlogia-backup-${timestamp}.sql.gz`;
  return { targetDir, filename, fullPath: path.join(targetDir, filename) };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let outDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--out" || value === "-o") {
      outDir = args[index + 1];
      index += 1;
    }
  }
  return { outDir };
}

async function run() {
  const { outDir } = parseArgs();
  const dbUrl = ensureDatabaseUrl();
  const { targetDir, fullPath } = resolveOutputPath(outDir);

  await mkdir(targetDir, { recursive: true });

  const database = dbUrl.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const env = { ...process.env };
  if (dbUrl.password) {
    env.MYSQL_PWD = decodeURIComponent(dbUrl.password);
  }

  const dump = spawn(
    "mysqldump",
    [
      `-h${dbUrl.hostname}`,
      `-P${dbUrl.port || "3306"}`,
      `-u${decodeURIComponent(dbUrl.username)}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--column-statistics=0",
      database,
    ],
    { env, stdio: ["ignore", "pipe", "inherit"] },
  );

  if (!dump.stdout) {
    throw new Error("mysqldump did not provide stdout");
  }

  const gzip = createGzip({ level: 9 });
  const outStream = createWriteStream(fullPath);

  await pipeline(dump.stdout, gzip, outStream);

  const exitCode: number = await new Promise((resolve) => {
    dump.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`mysqldump exited with code ${exitCode}`);
  }

  const stats = await stat(fullPath);
  console.log(`Backup complete: ${fullPath} (${Math.round(stats.size / 1024)} KiB)`);
}

run().catch((error) => {
  console.error(`[db:backup] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
