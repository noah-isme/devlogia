import { Prisma } from "@prisma/client";
import type { PostStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { notifySearchEngines, siteConfig } from "@/lib/seo";
import { triggerOutbound } from "@/lib/webhooks";

const BATCH_SIZE = 50;

type ScheduledPost = {
  readonly id: string;
  readonly slug: string;
  readonly status: PostStatus;
  readonly publishedAt: Date | null;
};

type ScheduledPublishingClient = {
  readonly post: {
    findMany(input: {
      where: { status: "SCHEDULED"; publishedAt: { lte: Date } };
      orderBy: { publishedAt: "asc" };
      take: number;
      select: { id: true; slug: true; status: true; publishedAt: true };
    }): Promise<readonly ScheduledPost[]>;
    update(input: {
      where: { id: string; status: "SCHEDULED" };
      data: { status: "PUBLISHED"; publishedAt: Date };
      select: { id: true; slug: true; status: true; publishedAt: true };
    }): Promise<ScheduledPost>;
  };
  readonly auditLog: {
    create(input: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
  readonly outboxEvent: {
    create(input: { data: { eventType: string; payload: Prisma.InputJsonValue } }): Promise<unknown>;
  };
};

/**
 * Publish due scheduled posts using transactional outbox pattern for concurrency safety.
 * Each post is processed in its own transaction to ensure atomicity of:
 * - Post status update (only if still SCHEDULED)
 * - Audit log entry
 * - Outbox event for webhook delivery
 */
export async function publishDueScheduledPosts(input: {
  readonly now?: Date;
  readonly prisma?: ScheduledPublishingClient;
  readonly triggerOutbound?: typeof triggerOutbound;
  readonly notifySearchEngines?: typeof notifySearchEngines;
} = {}) {
  const now = input.now ?? new Date();
  const prismaClient = input.prisma ?? prisma;
  const outbound = input.triggerOutbound ?? triggerOutbound;
  const notify = input.notifySearchEngines ?? notifySearchEngines;

  // Find due posts - but don't lock them yet; we'll use conditional update per post
  const duePosts = await prismaClient.post.findMany({
    where: { status: "SCHEDULED", publishedAt: { lte: now } },
    orderBy: { publishedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true; slug: true; status: true; publishedAt: true },
  });

  let published = 0;

  for (const post of duePosts) {
    // Use a transaction to ensure atomicity: update post + create audit + create outbox event
    // The update includes `status: "SCHEDULED"` in where clause for concurrency safety
    try {
      await prismaClient.$transaction(async (tx) => {
        const updated = await tx.post.update({
          where: { id: post.id, status: "SCHEDULED" },
          data: { status: "PUBLISHED", publishedAt: now },
          select: { id: true; slug: true; status: true; publishedAt: true },
        });

        // Only proceed if the post was actually updated (still SCHEDULED)
        if (updated) {
          await tx.auditLog.create({
            data: {
              userId: null,
              action: "post:publish",
              targetId: updated.id,
              meta: { slug: updated.slug, source: "scheduled-worker" },
            },
          });

          // Create outbox event for reliable webhook delivery
          await tx.outboxEvent.create({
            data: {
              eventType: "post.published",
              payload: {
                id: updated.id,
                slug: updated.slug,
                status: updated.status,
                url: `${siteConfig.url}/blog/${updated.slug}`,
              },
            },
          });

          published++;
        }
      });
    } catch (error) {
      // If update fails due to concurrent modification (post no longer SCHEDULED),
      // Prisma will throw P2025 (Record to update not found). Skip silently.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        console.log(`Post ${post.id} was already published by another worker, skipping`);
        continue;
      }
      throw error;
    }
  }

  if (published > 0) {
    notify();
  }

  return { published };
}

/**
 * Process pending outbox events for reliable webhook delivery.
 * Should be called by a separate worker process.
 */
export async function processOutboxEvents(input: {
  readonly prisma?: ScheduledPublishingClient;
  readonly triggerOutbound?: typeof triggerOutbound;
  readonly batchSize?: number;
} = {}) {
  const prismaClient = input.prisma ?? prisma;
  const outbound = input.triggerOutbound ?? triggerOutbound;
  const batchSize = input.batchSize ?? 50;

  const pendingEvents = await prismaClient.outboxEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  for (const event of pendingEvents) {
    try {
      await outbound(event.eventType, event.payload);
      
      await prismaClient.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch (error) {
      const attempts = event.attempts + 1;
      const maxAttempts = 5;
      
      if (attempts >= maxAttempts) {
        await prismaClient.outboxEvent.update({
          where: { id: event.id },
          data: { 
            status: "FAILED", 
            attempts,
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      } else {
        await prismaClient.outboxEvent.update({
          where: { id: event.id },
          data: { 
            attempts,
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}
