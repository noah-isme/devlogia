import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { presenceManager } from "@/lib/collaboration/presence";

const workspaceInputSchema = z
  .object({
    tenantId: z.string().cuid(),
    name: z.string().min(3).max(191),
    slug: z.string().min(3).max(191).optional(),
    createdBy: z.string().cuid(),
  })
  .strict();

export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;

const workspaceListSchema = z.object({
  tenantId: z.string().cuid(),
});

export type WorkspaceListInput = z.infer<typeof workspaceListSchema>;

const presenceUpdateSchema = z
  .object({
    sessionId: z.string().cuid(),
    workspaceId: z.string().cuid(),
    userId: z.string().cuid(),
    status: z.enum(["online", "idle", "disconnected"] as const),
  })
  .strict();

export type PresenceUpdateInput = z.infer<typeof presenceUpdateSchema>;

export type WorkspaceSummary = Prisma.WorkspaceGetPayload<{
  include: {
    members: { include: { user: { select: { id: true; email: true } } } };
    sessions: { where: { active: true }; include: { presence: true } };
    creator: { select: { id: true; email: true } };
  };
}>;

export async function createWorkspace(payload: unknown) {
  const parsed = workspaceInputSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    const error = new Error("Database is not available");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
  const baseSlug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.name);
  const slug = baseSlug.slice(0, 191);

  const workspace = await prisma.workspace.create({
    data: {
      tenantId: parsed.tenantId,
      name: parsed.name.trim(),
      slug,
      createdBy: parsed.createdBy,
      members: {
        create: {
          userId: parsed.createdBy,
          role: "OWNER",
        },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, email: true } } } },
      sessions: { where: { active: true }, include: { presence: true } },
      creator: { select: { id: true, email: true } },
    },
  });

  return workspace satisfies WorkspaceSummary;
}

export async function listWorkspaces(input: WorkspaceListInput) {
  const parsed = workspaceListSchema.parse(input ?? {});
  if (!isDatabaseEnabled) {
    return [] as WorkspaceSummary[];
  }
  const workspaces = await prisma.workspace.findMany({
    where: { tenantId: parsed.tenantId },
    include: {
      members: { include: { user: { select: { id: true, email: true } } } },
      sessions: { where: { active: true }, include: { presence: true } },
      creator: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return workspaces satisfies WorkspaceSummary[];
}

export async function ensureWorkspaceMember(workspaceId: string, userId: string) {
  if (!isDatabaseEnabled) {
    return null;
  }
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
}

export async function startWorkspaceSession(workspaceId: string) {
  if (!isDatabaseEnabled) {
    return null;
  }
  const existing = await prisma.collaborationSession.findFirst({
    where: { workspaceId, active: true },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    return existing;
  }
  return prisma.collaborationSession.create({
    data: { workspaceId },
  });
}

export async function endWorkspaceSession(sessionId: string) {
  if (!isDatabaseEnabled) {
    return;
  }
  await prisma.collaborationSession.update({
    where: { id: sessionId },
    data: { active: false, endedAt: new Date() },
  });
}

export async function updatePresence(payload: unknown) {
  const parsed = presenceUpdateSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    presenceManager.update(parsed.workspaceId, {
      userId: parsed.userId,
      sessionId: parsed.sessionId,
      status: parsed.status,
      lastSeenAt: new Date(),
    });
    return;
  }
  const record = await prisma.presenceState.upsert({
    where: {
      sessionId_userId: {
        sessionId: parsed.sessionId,
        userId: parsed.userId,
      },
    },
    update: {
      status: parsed.status.toUpperCase() as "ONLINE" | "IDLE" | "DISCONNECTED",
      lastSeenAt: new Date(),
    },
    create: {
      sessionId: parsed.sessionId,
      userId: parsed.userId,
      status: parsed.status.toUpperCase() as "ONLINE" | "IDLE" | "DISCONNECTED",
    },
    select: { sessionId: true, userId: true, status: true, lastSeenAt: true },
  });
  presenceManager.update(parsed.workspaceId, {
    userId: record.userId,
    sessionId: record.sessionId,
    status: parsed.status,
    lastSeenAt: record.lastSeenAt,
  });
}

export async function disconnectPresence(workspaceId: string, sessionId: string, userId: string) {
  if (isDatabaseEnabled) {
    await prisma.presenceState.updateMany({
      where: { sessionId, userId },
      data: { status: "DISCONNECTED", lastSeenAt: new Date() },
    });
  }
  presenceManager.update(workspaceId, {
    userId,
    sessionId,
    status: "disconnected",
    lastSeenAt: new Date(),
  });
}
