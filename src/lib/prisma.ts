import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

const prismaClient = isDatabaseEnabled
  ? globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    })
  : undefined;

if (prismaClient && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma: PrismaClient =
  prismaClient ??
  (new Proxy({} as PrismaClient, {
    get(_target, property) {
      throw new Error(
        `Attempted to access PrismaClient.${String(property)} without a configured DATABASE_URL.`,
      );
    },
  }) as PrismaClient);
