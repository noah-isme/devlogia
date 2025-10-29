import { PrismaClient } from "@prisma/client";

import { encryptAuditField } from "@/lib/security/audit-encryption";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL ?? "";
const isFakeDatabaseUrl = databaseUrl.startsWith("fake://");
const fallbackPrismaUrl = "mysql://stub:stub@127.0.0.1:3306/devlogia_static";
let loggedSkipMessage = false;

const logSkipMessage = () => {
  if (!loggedSkipMessage) {
    console.warn("Skipping DB connect for static build");
    loggedSkipMessage = true;
  }
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: isFakeDatabaseUrl ? { db: { url: fallbackPrismaUrl } } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

void (async () => {
  try {
    if (isFakeDatabaseUrl) {
      throw new Error("fake-database-url");
    }

    await prismaClient.$connect();
  } catch {
    logSkipMessage();
  }
})();

type GenericMiddleware = (params: unknown, next: (params: unknown) => Promise<unknown>) => Promise<unknown>;

const auditEncryptionMiddleware: GenericMiddleware = async (params, next) => {
  const castParams = params as { model?: string; action?: string; args?: { data?: unknown } };
  if (castParams.model === "AIAuditLog") {
    if (castParams.action === "create" || castParams.action === "update") {
      const data = (castParams.args?.data as { promptExcerpt?: string } | undefined) ?? undefined;
      if (data?.promptExcerpt) {
        data.promptExcerpt = encryptAuditField(data.promptExcerpt);
      }
    }
    if (castParams.action === "createMany" && Array.isArray(castParams.args?.data)) {
      for (const record of (castParams.args?.data as Array<{ promptExcerpt?: string }>)) {
        if (record.promptExcerpt) {
          record.promptExcerpt = encryptAuditField(record.promptExcerpt);
        }
      }
    }
  }
  return next(params);
};

if (typeof (prismaClient as { $use?: unknown }).$use === "function") {
  (prismaClient as unknown as { $use: (middleware: GenericMiddleware) => void }).$use(auditEncryptionMiddleware);
} else {
  logger.warn("Prisma client does not expose $use; skipping audit encryption middleware");
}

export const isDatabaseEnabled = Boolean(databaseUrl) && !isFakeDatabaseUrl;

export const prisma = prismaClient;

type FindManyDelegate<T> = {
  findMany: (args?: unknown) => Promise<T[]>;
};

export async function safeFindMany<T = unknown>(
  model: keyof PrismaClient,
  args?: unknown,
): Promise<T[]> {
  if (!isDatabaseEnabled) {
    const reason = isFakeDatabaseUrl ? "static fallback" : "missing";
    console.warn(`[Devlogia] DATABASE_URL ${reason} — skipping query for ${String(model)}`);
    return [] as T[];
  }

  const delegate = prisma[model as keyof PrismaClient] as unknown;
  if (!delegate || typeof delegate !== "object") {
    console.warn(`[Devlogia] Prisma model ${String(model)} is unavailable on the client.`);
    return [] as T[];
  }

  const findMany = (delegate as FindManyDelegate<T>).findMany;
  if (typeof findMany !== "function") {
    console.warn(`[Devlogia] Prisma model ${String(model)} does not expose findMany.`);
    return [] as T[];
  }

  try {
    return (await (args === undefined ? findMany() : findMany(args))) ?? [];
  } catch (error) {
    console.warn(`[Devlogia] Failed to run findMany for ${String(model)}:`, error);
    return [] as T[];
  }
}
