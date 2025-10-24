import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

type FindManyDelegate<T> = {
  findMany: (args?: unknown) => Promise<T[]>;
};

export async function safeFindMany<T = unknown>(
  model: keyof PrismaClient,
  args?: unknown,
): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    console.warn(`[Devlogia] DATABASE_URL missing — skipping query for ${String(model)}`);
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
