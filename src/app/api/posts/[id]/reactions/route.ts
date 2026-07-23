import { NextResponse } from "next/server";

import { isDatabaseEnabled, prisma } from "@/lib/prisma";

const ALLOWED_REACTIONS = ["clap", "heart", "fire", "rocket", "thinking"] as const;
type ReactionType = (typeof ALLOWED_REACTIONS)[number];

type RouteParams = {
  params: Promise<{ id: string }>;
};

async function getFormattedReactions(postId: string) {
  const defaultReactions: Record<ReactionType, number> = {
    clap: 0,
    heart: 0,
    fire: 0,
    rocket: 0,
    thinking: 0,
  };

  if (!isDatabaseEnabled) {
    return defaultReactions;
  }

  const list = await prisma.postReaction.findMany({
    where: { postId },
    select: { type: true, count: true },
  });

  for (const item of list) {
    if (item.type in defaultReactions) {
      defaultReactions[item.type as ReactionType] = item.count;
    }
  }

  return defaultReactions;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const reactions = await getFormattedReactions(id);
    return NextResponse.json({ reactions });
  } catch (error) {
    console.error(`Failed to fetch reactions for post ${id}`, error);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const type: ReactionType = ALLOWED_REACTIONS.includes(body.type) ? body.type : "clap";
    const incrementAmount = typeof body.amount === "number" && body.amount > 0 && body.amount <= 10 ? body.amount : 1;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await prisma.postReaction.upsert({
      where: {
        postId_type: {
          postId: id,
          type,
        },
      },
      update: {
        count: { increment: incrementAmount },
      },
      create: {
        postId: id,
        type,
        count: incrementAmount,
      },
    });

    const reactions = await getFormattedReactions(id);
    return NextResponse.json({ reactions });
  } catch (error) {
    console.error(`Failed to update reaction for post ${id}`, error);
    return NextResponse.json({ error: "Failed to submit reaction" }, { status: 500 });
  }
}
