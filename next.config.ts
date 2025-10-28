import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";
import createMDX from "@next/mdx";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "fake://stub";
}

const withMDX = createMDX({ extension: /\.mdx?$/ });

function resolveGitSha() {
  try {
    return (
      process.env.NEXT_PUBLIC_GIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
    );
  } catch {
    return "unknown";
  }
}

function resolveSchemaVersion() {
  if (process.env.NEXT_PUBLIC_SCHEMA_VERSION) {
    return process.env.NEXT_PUBLIC_SCHEMA_VERSION;
  }

  try {
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    const entries = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    return entries.at(-1) ?? "unknown";
  } catch {
    return "unknown";
  }
}

const buildTime = new Date().toISOString();
const gitSha = resolveGitSha();
const schemaVersion = resolveSchemaVersion();

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["sonner", "@aws-sdk/client-s3", "zod"],
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_SCHEMA_VERSION: schemaVersion,
  },
};

export default withMDX(nextConfig);
