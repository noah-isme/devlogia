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
      where: { id: string };
      data: { status: "PUBLISHED"; publishedAt: Date };
      select: { id: true; slug: true; status: true; publishedAt: true };
    }): Promise<ScheduledPost>;
  };
  readonly auditLog: {
    create(input: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

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
  const duePosts = await prismaClient.post.findMany({
    where: { status: "SCHEDULED", publishedAt: { lte: now } },
    orderBy: { publishedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, slug: true, status: true, publishedAt: true },
  });

  for (const post of duePosts) {
    const updated = await prismaClient.post.update({
      where: { id: post.id },
      data: { status: "PUBLISHED", publishedAt: now },
      select: { id: true, slug: true, status: true, publishedAt: true },
    });
    await prismaClient.auditLog.create({
      data: {
        userId: null,
        action: "post:publish",
        targetId: updated.id,
        meta: { slug: updated.slug, source: "scheduled-worker" },
      },
    });
    await outbound("post.published", {
      id: updated.id,
      slug: updated.slug,
      status: updated.status,
      url: `${siteConfig.url}/blog/${updated.slug}`,
    });
  }

  if (duePosts.length > 0) {
    notify();
  }

  return { published: duePosts.length };
}
