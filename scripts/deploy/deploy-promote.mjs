import process from "node:process";
import { spawn } from "node:child_process";

function parseArgs() {
  const args = process.argv.slice(2);
  let source = process.env.STAGING_URL;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if ((value === "--staging" || value === "-s") && args[index + 1]) {
      source = args[index + 1];
      index += 1;
    }
  }

  if (!source) {
    throw new Error("Staging URL is required via --staging or STAGING_URL");
  }

  return source.replace(/\/$/, "");
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function ensureReady(baseUrl) {
  const readyUrl = new URL("/api/ready", baseUrl).toString();
  const response = await fetch(readyUrl, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) {
    throw new Error(`Readiness check failed for ${readyUrl} (${response.status})`);
  }
  const data = await response.json();
  if (data.status !== "ok") {
    throw new Error(`Readiness returned status ${data.status}`);
  }
  console.log(`[deploy:promote] Staging ready: ${readyUrl}`);
}

async function captureVersion(baseUrl) {
  const versionUrl = new URL("/api/_version", baseUrl).toString();
  const response = await fetch(versionUrl, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch version from ${versionUrl}`);
  }
  const data = await response.json();
  console.log(`[deploy:promote] Promoting build ${data.version.gitSha} (${data.version.schemaVersion})`);
  return data.version.gitSha;
}

async function main() {
  const stagingUrl = parseArgs();
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL must be configured for production");
  }

  await ensureReady(stagingUrl);
  await captureVersion(stagingUrl);

  console.log("[deploy:promote] Taking production snapshot prior to promote");
  await run("pnpm", ["db:backup", "--out", "backups/production"]);

  console.log("[deploy:promote] Promote by aliasing staging deployment to production (e.g. vercel promote)");
  console.log("[deploy:promote] After promote, run: curl -fsSL ${NEXT_PUBLIC_APP_URL}/api/ready");
  console.log("[deploy:promote] Use scripts/deploy-promote.mjs again with --staging to verify roll-forward");
}

main().catch((error) => {
  console.error(`[deploy:promote] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
