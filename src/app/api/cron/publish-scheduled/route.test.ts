import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const publishDueScheduledPostsMock = vi.fn(async () => ({ published: 3 }));

vi.mock("@/lib/cms/scheduled-publishing", () => ({
  publishDueScheduledPosts: publishDueScheduledPostsMock,
}));

describe("/api/cron/publish-scheduled", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    publishDueScheduledPostsMock.mockClear();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  test("triggers publishing in non-production when no CRON_SECRET is set", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/cron/publish-scheduled");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.publishedCount).toBe(3);
    expect(publishDueScheduledPostsMock).toHaveBeenCalledOnce();
  });

  test("enforces Authorization header when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "super-secret-token";
    const { GET } = await import("./route");

    // Unauthorized request
    const reqUnauthorized = new Request("http://localhost:3000/api/cron/publish-scheduled");
    const resUnauthorized = await GET(reqUnauthorized);
    expect(resUnauthorized.status).toBe(401);

    // Authorized request with Bearer token
    const reqAuthorized = new Request("http://localhost:3000/api/cron/publish-scheduled", {
      headers: { authorization: "Bearer super-secret-token" },
    });
    const resAuthorized = await GET(reqAuthorized);
    expect(resAuthorized.status).toBe(200);
    const body = await resAuthorized.json();
    expect(body.publishedCount).toBe(3);
  });
});
