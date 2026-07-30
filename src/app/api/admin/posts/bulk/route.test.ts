import { beforeEach, describe, expect, test, vi } from "vitest";

const authMock = vi.fn(async () => ({ user: { id: "u1", role: "admin" } }));
const updateManyPostsMock = vi.fn(async () => ({ count: 2 }));
const deleteManyPostsMock = vi.fn(async () => ({ count: 2 }));
const createAuditLogMock = vi.fn(async () => ({ id: "al_1" }));

const dbState = { enabled: true };

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    post: {
      updateMany: updateManyPostsMock,
      deleteMany: deleteManyPostsMock,
    },
    auditLog: {
      create: createAuditLogMock,
    },
  },
}));

describe("/api/admin/posts/bulk", () => {
  beforeEach(() => {
    dbState.enabled = true;
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    updateManyPostsMock.mockReset();
    deleteManyPostsMock.mockReset();
    createAuditLogMock.mockReset();
    updateManyPostsMock.mockResolvedValue({ count: 2 });
    deleteManyPostsMock.mockResolvedValue({ count: 2 });
  });

  test("POST publishes multiple posts", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost:3001/api/admin/posts/bulk", {
      method: "POST",
      body: JSON.stringify({ action: "publish", postIds: ["p1", "p2"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(updateManyPostsMock).toHaveBeenCalledOnce();
  });

  test("POST deletes multiple posts", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost:3001/api/admin/posts/bulk", {
      method: "POST",
      body: JSON.stringify({ action: "delete", postIds: ["p1", "p2"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(deleteManyPostsMock).toHaveBeenCalledOnce();
  });
});
