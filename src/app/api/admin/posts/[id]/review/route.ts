import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createPostRevisionSnapshot } from "@/lib/cms/revisions";
import { notifySearchEngines, siteConfig } from "@/lib/seo";
import { triggerOutbound } from "@/lib/webhooks";

const reviewActionSchema = z.object({
  action: z.enum(["submit", "request_changes", "approve", "publish"]),
  feedback: z.string().trim().max(1000).optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = session.user;

  const post = await prisma.post.findFirst({
    where: { id },
    include: { author: true, tags: { include: { tag: true } } },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = reviewActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, feedback } = parsed.data;

  // 1. Writer Submits Draft for Review
  if (action === "submit") {
    if (!can(user, "post:submit_review", { authorId: post.authorId })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: "IN_REVIEW" },
      include: { author: true, tags: { include: { tag: true } } },
    });

    await recordAuditLog({
      userId: user.id,
      action: "post:submit_review",
      targetId: post.id,
      meta: { feedback: feedback ?? "Submitted draft for editorial review" },
    });

    await createPostRevisionSnapshot({
      prisma,
      post: updatedPost,
      userId: user.id,
      reason: "manual",
    });

    return NextResponse.json({ post: updatedPost, message: "Draft submitted for editorial review" });
  }

  // 2. Editor/Admin Requests Changes
  if (action === "request_changes") {
    if (user.role === "writer") {
      return NextResponse.json({ error: "Writers cannot request changes on review tasks" }, { status: 403 });
    }
    if (!can(user, "post:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: "CHANGES_REQUESTED" },
      include: { author: true, tags: { include: { tag: true } } },
    });

    await recordAuditLog({
      userId: user.id,
      action: "post:request_changes",
      targetId: post.id,
      meta: { feedback: feedback ?? "Editor requested changes" },
    });

    await createPostRevisionSnapshot({
      prisma,
      post: updatedPost,
      userId: user.id,
      reason: "manual",
    });

    return NextResponse.json({ post: updatedPost, message: "Changes requested from author" });
  }

  // 3. Editor/Admin Approves Post
  if (action === "approve") {
    if (user.role === "writer") {
      return NextResponse.json({ error: "Writers cannot approve post reviews" }, { status: 403 });
    }
    if (!can(user, "post:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: "APPROVED" },
      include: { author: true, tags: { include: { tag: true } } },
    });

    await recordAuditLog({
      userId: user.id,
      action: "post:approve",
      targetId: post.id,
      meta: { feedback: feedback ?? "Approved by editor" },
    });

    await createPostRevisionSnapshot({
      prisma,
      post: updatedPost,
      userId: user.id,
      reason: "manual",
    });

    return NextResponse.json({ post: updatedPost, message: "Post approved for publishing" });
  }

  // 4. Admin Approves & Publishes Post
  if (action === "publish") {
    if (user.role === "writer") {
      return NextResponse.json({ error: "Writers are not permitted to publish posts directly" }, { status: 403 });
    }
    if (!can(user, "post:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: post.publishedAt ?? new Date(),
      },
      include: { author: true, tags: { include: { tag: true } } },
    });

    await recordAuditLog({
      userId: user.id,
      action: "post:publish",
      targetId: post.id,
      meta: { feedback: feedback ?? "Approved and published by admin", slug: updatedPost.slug },
    });

    await createPostRevisionSnapshot({
      prisma,
      post: updatedPost,
      userId: user.id,
      reason: "publish",
    });

    const publicUrl = `${siteConfig.url}/blog/${updatedPost.slug}`;
    await triggerOutbound("post.published", {
      id: updatedPost.id,
      slug: updatedPost.slug,
      status: updatedPost.status,
      url: publicUrl,
    });
    void notifySearchEngines();

    return NextResponse.json({ post: updatedPost, message: "Post approved and published" });
  }

  return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
}
