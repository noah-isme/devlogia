import { render, screen, within } from "@testing-library/react";
import type { PostStatus, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type PublishedPost = Prisma.PostGetPayload<{
  include: { author: true; tags: { include: { tag: true } } };
}>;

const originalDatabaseUrl = process.env.DATABASE_URL;
const baseDate = new Date("2024-02-15T12:00:00.000Z");

function makePost(input: {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly contentMdx?: string;
  readonly publishedAt: Date;
  readonly tags: readonly { readonly name: string; readonly slug: string }[];
}): PublishedPost {
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    contentMdx: input.contentMdx ?? `# ${input.title}`,
    coverUrl: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    ogImageUrl: null,
    status: "PUBLISHED" as PostStatus,
    publishedAt: input.publishedAt,
    authorId: "user_1",
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
    author: {
      id: "user_1",
      email: "owner@devlogia.test",
      passwordHash: "",
      isActive: true,
      createdAt: baseDate,
    },
    tags: input.tags.map((tag, index) => ({
      postId: input.id,
      tagId: `tag_${index}_${tag.slug}`,
      tag: {
        id: `tag_${index}_${tag.slug}`,
        name: tag.name,
        slug: tag.slug,
      },
    })),
  };
}

const posts = [
  makePost({
    id: "post_prisma_main",
    slug: "prisma-main",
    title: "Prisma deployment guide",
    summary: "Connection pooling for production teams.",
    contentMdx: "# Prisma deployment\n\n## Pooling\n\n## Observability\n\n## Rollouts",
    publishedAt: new Date("2024-02-15T12:00:00.000Z"),
    tags: [{ name: "Prisma", slug: "prisma" }, { name: "DevOps", slug: "devops" }],
  }),
  makePost({
    id: "post_prisma_related",
    slug: "prisma-related",
    title: "Prisma search playbook",
    summary: "How teams tune search queries.",
    publishedAt: new Date("2024-02-10T12:00:00.000Z"),
    tags: [{ name: "Prisma", slug: "prisma" }],
  }),
  makePost({
    id: "post_nextjs",
    slug: "nextjs-edge",
    title: "Next.js edge notes",
    summary: "Edge rendering checklist.",
    publishedAt: new Date("2024-01-20T12:00:00.000Z"),
    tags: [{ name: "Next.js", slug: "nextjs" }],
  }),
] as const;

const tagRows = [
  { id: "tag_prisma", name: "Prisma", slug: "prisma" },
  { id: "tag_nextjs", name: "Next.js", slug: "nextjs" },
];

type TestPostFilter = {
  readonly slug?: string;
  readonly NOT?: { readonly id?: string };
  readonly tags?: { readonly some?: { readonly tag?: { readonly slug?: string | { readonly in?: readonly string[] } } } };
  readonly OR?: readonly {
    readonly title?: { readonly contains?: string };
    readonly summary?: { readonly contains?: string };
    readonly contentMdx?: { readonly contains?: string };
  }[];
};

const safeFindMany = vi.fn(async (_model: string, args?: { readonly where?: TestPostFilter; readonly take?: number }) => {
  const where = args?.where;
  const requestedSlug = where?.slug;
  if (typeof requestedSlug === "string") {
    return posts.filter((post) => post.slug === requestedSlug);
  }

  const excludedId = where?.NOT && "id" in where.NOT ? where.NOT.id : undefined;
  const tagInFilter = where?.tags && "some" in where.tags ? where.tags.some?.tag?.slug : undefined;
  const tagSlugs = tagInFilter && typeof tagInFilter === "object" && "in" in tagInFilter ? tagInFilter.in : undefined;
  if (Array.isArray(tagSlugs)) {
    return posts.filter(
      (post) => post.id !== excludedId && post.tags.some(({ tag }) => tagSlugs.includes(tag.slug)),
    );
  }

  const tagSlug = where?.tags && "some" in where.tags ? where.tags.some?.tag?.slug : undefined;
  const query = where?.OR?.flatMap((condition) => [condition.title, condition.summary, condition.contentMdx])
    .map((filter) => (typeof filter === "object" && filter !== null && "contains" in filter ? filter.contains : undefined))
    .find((value): value is string => typeof value === "string")
    ?.toLowerCase();

  const filtered = posts.filter((post) => {
    const matchesTag = typeof tagSlug === "string" ? post.tags.some(({ tag }) => tag.slug === tagSlug) : true;
    const searchable = `${post.title} ${post.summary ?? ""} ${post.contentMdx}`.toLowerCase();
    const matchesQuery = query ? searchable.includes(query) : true;
    return matchesTag && matchesQuery;
  });

  return typeof args?.take === "number" ? filtered.slice(0, args.take) : filtered;
});

vi.mock("@/lib/prisma", () => ({
  isDatabaseEnabled: true,
  safeFindMany,
  prisma: {
    post: {
      findFirst: vi.fn(async ({ where }: { readonly where: { readonly slug: string } }) =>
        posts.find((post) => post.slug === where.slug) ?? null,
      ),
      findMany: vi.fn(async () => posts),
    },
    tag: {
      findMany: vi.fn(async () => tagRows),
      findFirst: vi.fn(async ({ where }: { readonly where: { readonly slug: string } }) =>
        tagRows.find((tag) => tag.slug === where.slug) ?? null,
      ),
    },
  },
}));

vi.mock("@/lib/mdx", () => ({
  renderMdx: vi.fn(async () => <div>Rendered MDX body</div>),
}));

vi.mock("@/components/post-share-section", () => ({
  PostShareSection: () => <div>Share section</div>,
}));

vi.mock("@/components/feedback-form", () => ({
  FeedbackForm: () => <div>Feedback form</div>,
}));

vi.mock("@/components/personalization/KeyHighlights", () => ({
  KeyHighlights: () => <div>Key highlights</div>,
}));

vi.mock("@/components/personalization/PersonalizedFeedSection", () => ({
  PersonalizedFeedSection: ({ title }: { readonly title?: string }) => <div>{title ?? "Personalized feed"}</div>,
}));

beforeAll(() => {
  process.env.DATABASE_URL = "mysql://stub:stub@127.0.0.1:3306/devlogia_test";
});

afterAll(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("public blog discovery", () => {
  it("renders tag archive breadcrumbs and archive links when filtered by tag", async () => {
    const { default: BlogPage } = await import("@/app/(public)/blog/page");

    render(await BlogPage({ searchParams: Promise.resolve({ tag: "prisma" }) }));

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Blog");
    expect(screen.getByRole("heading", { name: "Prisma posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "February 2024" })).toHaveAttribute("href", "/blog/archive/2024/02");
  });

  it("renders specific empty states for search and tag filters", async () => {
    const { default: BlogPage } = await import("@/app/(public)/blog/page");

    render(await BlogPage({ searchParams: Promise.resolve({ q: "missing", tag: "prisma" }) }));

    const emptyState = screen.getByRole("status");

    expect(emptyState).toHaveTextContent('No posts match "missing" in Prisma');
    expect(within(emptyState).getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/blog?tag=prisma");
    expect(within(emptyState).getByRole("link", { name: "Clear tag" })).toHaveAttribute("href", "/blog?q=missing");
  });

  it("renders non-AI related posts that share tags", async () => {
    const { default: BlogPostPage } = await import("@/app/(public)/blog/[slug]/page");

    render(await BlogPostPage({ params: Promise.resolve({ slug: "prisma-main" }) }));

    const related = screen.getByRole("region", { name: "Related posts" });

    expect(within(related).getByRole("link", { name: "Prisma search playbook" })).toHaveAttribute(
      "href",
      "/blog/prisma-related",
    );
    expect(within(related).queryByText("Next.js edge notes")).not.toBeInTheDocument();
  });
});
