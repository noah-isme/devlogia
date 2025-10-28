import { render, screen } from "@testing-library/react";
import type { Post, PostStatus, User } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

vi.mock("@/lib/prisma", () => {
  const mockPost = {
    id: "post_1",
    slug: "hello-world",
    title: "Hello World",
    summary: "Summary",
    contentMdx: "# Hello",
    coverUrl: null,
    status: "PUBLISHED" as PostStatus,
    publishedAt: new Date("2024-01-01"),
    authorId: "user_1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
  } satisfies Partial<Post>;

  const posts = [
    {
      ...mockPost,
      author: { id: "user_1", email: "owner@test", passwordHash: "", isActive: true, createdAt: new Date() } as User,
      tags: [],
    },
  ];

  return {
    isDatabaseEnabled: true,
    safeFindMany: vi.fn().mockResolvedValue(posts),
    prisma: {
      post: {
        findMany: vi.fn().mockResolvedValue(posts),
      },
      tag: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        { id: "post_1", sortKey: new Date("2024-01-01") },
      ]),
    },
  };
});

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test-db";
});

afterAll(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
});

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    estimateReadingTime: vi.fn().mockReturnValue("3 min read"),
  };
});

describe("HomePage", () => {
  it("renders published posts", async () => {
    const { default: HomePage } = await import("@/app/(public)/page");
    render(await HomePage({ searchParams: {} }));

    expect(
      screen.getByRole("heading", { name: /deep writing for curious developers/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hello world/i })).toBeInTheDocument();
    expect(screen.getByText(/3 min read/i)).toBeInTheDocument();
  });
});
