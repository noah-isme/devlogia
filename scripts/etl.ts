import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, PostStatus, RoleName } from "@prisma/client";

type LegacyRole = {
  id: string;
  name: RoleName;
  description: string | null;
  createdAt: Date;
};

type LegacyUser = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
};

type LegacyUserRole = {
  id: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
};

type LegacyTag = {
  id: string;
  name: string;
  slug: string;
};

type LegacyPost = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  contentMdx: string;
  coverUrl: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
};

type LegacyPostTag = {
  postId: string;
  tagId: string;
};

type LegacyPage = {
  id: string;
  slug: string;
  title: string;
  contentMdx: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type LegacyMedia = {
  id: string;
  url: string;
  alt: string | null;
  ownerId: string | null;
  createdAt: Date;
  checksum?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type LegacyAuditLog = {
  id: string;
  userId: string | null;
  action: string;
  targetId: string | null;
  meta: unknown;
  createdAt: Date;
};

const legacyUrl = process.env.LEGACY_DATABASE_URL;

if (!legacyUrl) {
  console.warn("LEGACY_DATABASE_URL is not set. Skipping ETL.");
  process.exit(0);
}

const target = new PrismaClient();
const legacy = new PrismaClient({ datasources: { db: { url: legacyUrl } } });

const failures: { table: string; id: string; error: string }[] = [];
const summary: { table: string; success: number; failed: number }[] = [];

function recordFailure(table: string, id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push({ table, id, error: message });
  console.error(`[ETL] Failed to migrate ${table}#${id}: ${message}`);
}

async function migrateTable<T>(
  table: string,
  fetch: () => Promise<T[]>,
  handler: (record: T) => Promise<void>,
  getId: (record: T) => string,
) {
  const records = await fetch();
  let success = 0;
  let failed = 0;

  for (const record of records) {
    const id = getId(record);
    try {
      await handler(record);
      success += 1;
    } catch (error) {
      failed += 1;
      recordFailure(table, id, error);
    }
  }

  summary.push({ table, success, failed });
}

function deriveMediaPath(url: string, id: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\//, "");
    if (pathname) {
      return pathname;
    }
  } catch {
    // Ignore
  }
  return `uploads/migrated/${id}`;
}

async function main() {
  console.log("🚚 Starting ETL from", legacyUrl);

  await migrateTable(
    "Role",
    () => legacy.role.findMany().then((rows) => rows as unknown as LegacyRole[]),
    async (record) => {
      await target.role.upsert({
        where: { id: record.id },
        update: { name: record.name, description: record.description ?? undefined },
        create: { id: record.id, name: record.name, description: record.description ?? undefined, createdAt: record.createdAt },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "User",
    () => legacy.user.findMany().then((rows) => rows as unknown as LegacyUser[]),
    async (record) => {
      await target.user.upsert({
        where: { id: record.id },
        update: {
          email: record.email,
          passwordHash: record.passwordHash,
          isActive: record.isActive,
        },
        create: {
          id: record.id,
          email: record.email,
          passwordHash: record.passwordHash,
          isActive: record.isActive,
          createdAt: record.createdAt,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "UserRole",
    () => legacy.userRole.findMany().then((rows) => rows as unknown as LegacyUserRole[]),
    async (record) => {
      await target.userRole.upsert({
        where: { id: record.id },
        update: {
          userId: record.userId,
          roleId: record.roleId,
        },
        create: {
          id: record.id,
          userId: record.userId,
          roleId: record.roleId,
          assignedAt: record.assignedAt,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "Tag",
    () => legacy.tag.findMany().then((rows) => rows as unknown as LegacyTag[]),
    async (record) => {
      await target.tag.upsert({
        where: { id: record.id },
        update: {
          name: record.name,
          slug: record.slug,
        },
        create: {
          id: record.id,
          name: record.name,
          slug: record.slug,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "Post",
    () => legacy.post.findMany().then((rows) => rows as unknown as LegacyPost[]),
    async (record) => {
      await target.post.upsert({
        where: { id: record.id },
        update: {
          slug: record.slug,
          title: record.title,
          summary: record.summary,
          contentMdx: record.contentMdx,
          coverUrl: record.coverUrl ?? undefined,
          status: record.status,
          publishedAt: record.publishedAt ?? undefined,
          authorId: record.authorId,
        },
        create: {
          id: record.id,
          slug: record.slug,
          title: record.title,
          summary: record.summary,
          contentMdx: record.contentMdx,
          coverUrl: record.coverUrl ?? undefined,
          status: record.status,
          publishedAt: record.publishedAt ?? undefined,
          authorId: record.authorId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "PostTag",
    () => legacy.postTag.findMany().then((rows) => rows as unknown as LegacyPostTag[]),
    async (record) => {
      await target.postTag.upsert({
        where: { postId_tagId: { postId: record.postId, tagId: record.tagId } },
        update: {},
        create: { postId: record.postId, tagId: record.tagId },
      });
    },
    (record) => `${record.postId}-${record.tagId}`,
  );

  await migrateTable(
    "Page",
    () => legacy.page.findMany().then((rows) => rows as unknown as LegacyPage[]),
    async (record) => {
      await target.page.upsert({
        where: { id: record.id },
        update: {
          slug: record.slug,
          title: record.title,
          contentMdx: record.contentMdx,
          published: record.published,
        },
        create: {
          id: record.id,
          slug: record.slug,
          title: record.title,
          contentMdx: record.contentMdx,
          published: record.published,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "Media",
    () => legacy.media.findMany().then((rows) => rows as unknown as LegacyMedia[]),
    async (record) => {
      const pathValue = deriveMediaPath(record.url, record.id);
      const checksum = record.checksum ?? createHash("sha256").update(record.url ?? record.id).digest("hex");
      const sizeValue = Number((record as { sizeBytes?: number }).sizeBytes ?? 0);
      const size = Number.isFinite(sizeValue) ? Math.max(0, Math.trunc(sizeValue)) : 0;
      const mimeType = (record as { mimeType?: string }).mimeType ?? "application/octet-stream";

      await target.media.upsert({
        where: { id: record.id },
        update: {
          path: pathValue,
          mimeType,
          sizeBytes: size,
          checksum,
          publicUrl: record.url,
          alt: record.alt ?? undefined,
          ownerId: record.ownerId ?? undefined,
        },
        create: {
          id: record.id,
          path: pathValue,
          mimeType,
          sizeBytes: size,
          checksum,
          publicUrl: record.url,
          alt: record.alt ?? undefined,
          ownerId: record.ownerId ?? undefined,
          createdAt: record.createdAt,
        },
      });
    },
    (record) => record.id,
  );

  await migrateTable(
    "AuditLog",
    () => legacy.auditLog.findMany().then((rows) => rows as unknown as LegacyAuditLog[]),
    async (record) => {
      await target.auditLog.upsert({
        where: { id: record.id },
        update: {
          userId: record.userId ?? undefined,
          action: record.action,
          targetId: record.targetId ?? undefined,
          meta: record.meta ?? undefined,
        },
        create: {
          id: record.id,
          userId: record.userId ?? undefined,
          action: record.action,
          targetId: record.targetId ?? undefined,
          meta: record.meta ?? undefined,
          createdAt: record.createdAt,
        },
      });
    },
    (record) => record.id,
  );

  summary.forEach((entry) => {
    console.log(`✅ ${entry.table}: ${entry.success} migrated, ${entry.failed} failed`);
  });

  if (failures.length > 0) {
    const csv = ["table,id,error", ...failures.map((f) => `${f.table},${f.id},"${f.error.replace(/"/g, "'")}"`)].join("\n");
    const filePath = path.join(process.cwd(), `etl-failures-${Date.now()}.csv`);
    await writeFile(filePath, csv, "utf8");
    console.warn(`⚠️  Failures captured in ${filePath}`);
  }

  console.log("ETL completed with", failures.length, "errors.");
}

main()
  .catch((error) => {
    console.error("ETL failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.allSettled([target.$disconnect(), legacy.$disconnect()]);
  });
