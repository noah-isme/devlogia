import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  writer: vi.fn(),
  enforceCreatorRateLimit: vi.fn(),
  enforceMonthlyBudget: vi.fn(),
  moderateContent: vi.fn(),
  recordAIUsage: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/ai/provider", () => ({
  resolveAIProvider: () => ({ writer: mocks.writer }),
}));
vi.mock("@/lib/ai/guardrails", () => ({
  enforceCreatorRateLimit: mocks.enforceCreatorRateLimit,
  enforceMonthlyBudget: mocks.enforceMonthlyBudget,
  moderateContent: mocks.moderateContent,
  recordAIUsage: mocks.recordAIUsage,
  recordAuditLog: mocks.recordAuditLog,
  maskSensitiveContent: (value: string) => value,
}));

const post = {
  id: "post_1",
  title: "Reliable background jobs",
  summary: "How to safely run background work.",
  contentMdx:
    "# Background jobs\n\nUse an idempotent worker with observable retries.",
  status: "IN_REVIEW",
};

describe("POST /api/admin/posts/[id]/ai-review", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "openai";
    mocks.auth.mockResolvedValue({ user: { id: "admin_1", role: "admin" } });
    mocks.findUnique.mockResolvedValue(post);
    mocks.writer.mockResolvedValue({
      content: "## Summary\nStrong draft.",
      usage: { tokensIn: 12, tokensOut: 8, costUsd: 0.001 },
    });
    mocks.enforceCreatorRateLimit.mockResolvedValue({
      success: true,
      remaining: 29,
      reset: 123,
    });
    mocks.enforceMonthlyBudget.mockResolvedValue({
      allowed: true,
      remaining: 9.999,
      limit: 10,
    });
    mocks.moderateContent.mockResolvedValue({ flagged: false });
    mocks.recordAIUsage.mockResolvedValue(undefined);
    mocks.recordAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.AI_PROVIDER;
    vi.clearAllMocks();
  });

  test("returns disabled when AI is not configured", async () => {
    process.env.AI_PROVIDER = "none";
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/admin/posts/post_1/ai-review", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "post_1" }),
      },
    );

    expect(response.status).toBe(503);
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  test("allows only administrators", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "editor_1", role: "editor" } });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/admin/posts/post_1/ai-review", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "post_1" }),
      },
    );

    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  test("reviews server-side post content without changing its editorial state", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/admin/posts/post_1/ai-review", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "post_1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      review: "## Summary\nStrong draft.",
      advisory: true,
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "post_1" },
      select: {
        id: true,
        title: true,
        summary: true,
        contentMdx: true,
        status: true,
      },
    });
    expect(mocks.writer).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "editorial_review",
        title: post.title,
        content: post.contentMdx,
      }),
    );
    expect(mocks.recordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({ postId: post.id, task: "editorial_review" }),
    );
  });
});
