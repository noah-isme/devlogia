import { PrismaClient } from "@prisma/client";

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: isFakeDatabaseUrl ? { db: { url: fallbackPrismaUrl } } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

void (async () => {
  try {
    if (isFakeDatabaseUrl) {
      throw new Error("fake-database-url");
    }

    await prisma.$connect();
  } catch {
    logSkipMessage();
  }
})();

export const isDatabaseEnabled = Boolean(databaseUrl) && !isFakeDatabaseUrl;

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
