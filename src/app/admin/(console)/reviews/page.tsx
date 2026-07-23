import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { safeFindMany, isDatabaseEnabled } from "@/lib/prisma";
import { EditorialReviewQueue } from "@/components/admin/EditorialReviewQueue";

export const metadata = buildMetadata({
  title: "Editorial Reviews",
  description: "Review queue pipeline for editorial approval.",
});

type ReviewPostQueryResult = Prisma.PostGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        email: true;
      };
    };
    tags: { include: { tag: true } };
  };
}>;

export default async function EditorialReviewsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const { user } = session;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Editorial Queue unavailable</p>
        <p>Configure the <code>DATABASE_URL</code> environment variable to load review tasks.</p>
      </div>
    );
  }

  const reviewPosts = await safeFindMany<ReviewPostQueryResult>("post", {
    where: {
      status: { in: ["IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DRAFT"] },
      ...(user.role === "writer" ? { authorId: user.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      author: {
        select: {
          id: true,
          email: true,
        },
      },
      tags: { include: { tag: true } },
    },
  });

  const formattedPosts = reviewPosts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    status: p.status as "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "SCHEDULED",
    updatedAt: (p.updatedAt ?? p.createdAt).toISOString(),
    author: p.author ? { id: p.author.id, email: p.author.email } : null,
    tags: p.tags,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editorial Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Writers submit drafts for review → Editors receive review tasks → Admins approve before publishing.
        </p>
      </div>

      <EditorialReviewQueue initialPosts={formattedPosts} currentUserRole={user.role} />
    </div>
  );
}
