import { render, screen } from "@testing-library/react";
import type { Post, PostStatus, User } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

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

  return {
    isDatabaseEnabled: true,
    prisma: {
      post: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...mockPost,
            author: { id: "user_1", email: "admin@test", passwordHash: "", role: "admin", createdAt: new Date() } as User,
            tags: [],
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    },
  };
});

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    estimateReadingTime: vi.fn().mockReturnValue("3 min read"),
  };
});

import HomePage from "@/app/(public)/page";

describe("HomePage", () => {
  it("renders published posts", async () => {
    render(await HomePage({ searchParams: {} }));

    expect(
      screen.getByRole("heading", { name: /deep writing for curious developers/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hello world/i })).toBeInTheDocument();
    expect(screen.getByText(/3 min read/i)).toBeInTheDocument();
  });
});
