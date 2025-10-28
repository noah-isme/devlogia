import { readdirSync } from "node:fs";
import path from "node:path";

type SchemaState = {
  version: string;
  pending?: number | null;
};

const packageVersion = process.env.npm_package_version ?? "dev";
const buildSha =
  process.env.NEXT_PUBLIC_GIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  "unknown";
const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString();

function readLatestMigration(): string | null {
  try {
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    const entries = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    return entries.at(-1) ?? null;
  } catch {
    return null;
  }
}

const fallbackSchemaVersion =
  process.env.NEXT_PUBLIC_SCHEMA_VERSION ?? readLatestMigration() ?? "unknown";

export type VersionMetadata = {
  appVersion: string;
  gitSha: string;
  buildTime: string;
  schemaVersion: string;
};

export function getVersionMetadata(): VersionMetadata {
  return {
    appVersion: packageVersion,
    gitSha: buildSha,
    buildTime,
    schemaVersion: fallbackSchemaVersion,
  };
}

export async function fetchSchemaState(): Promise<SchemaState> {
  const { isDatabaseEnabled, prisma } = await import("@/lib/prisma");

  if (!isDatabaseEnabled) {
    return { version: fallbackSchemaVersion, pending: null };
  }

  try {
    const latest = await prisma.$queryRaw<{ version: string; finished_at: Date | null }[]>`
      SELECT version, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC, started_at DESC
      LIMIT 1
    `;

    const pending = await prisma.$queryRaw<{ pending: bigint }[]>`
      SELECT COUNT(*) AS pending
      FROM _prisma_migrations
      WHERE finished_at IS NULL
    `;

    const latestVersion = latest[0]?.version ?? fallbackSchemaVersion;
    const pendingCount = Number(pending[0]?.pending ?? 0);

    return { version: latestVersion, pending: pendingCount };
  } catch (error) {
    console.warn("Failed to read migration metadata", error);
    return { version: fallbackSchemaVersion, pending: null };
  }
}
