import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AuditLogPayload = {
  userId?: string | null;
  action: string;
  targetId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export async function recordAuditLog({ userId, action, targetId, meta }: AuditLogPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        targetId: targetId ?? null,
        ...(meta === undefined ? {} : { meta: meta ?? Prisma.JsonNull }),
      },
    });
  } catch (error) {
    console.error("Failed to record audit log", error);
  }
}
