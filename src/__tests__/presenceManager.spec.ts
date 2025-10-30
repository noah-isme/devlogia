import { describe, expect, it } from "vitest";

import { presenceManager } from "@/lib/collaboration/presence";

describe("presenceManager", () => {
  it("stores and broadcasts presence updates", async () => {
    const events: Array<{ workspaceId: string; count: number }> = [];
    const unsubscribe = presenceManager.subscribe("workspace-1", (event) => {
      events.push({ workspaceId: event.workspaceId, count: event.presence.length });
    });

    presenceManager.update("workspace-1", {
      userId: "user-1",
      sessionId: "session-1",
      status: "online",
      lastSeenAt: new Date("2024-01-01T00:00:00Z"),
    });

    presenceManager.update("workspace-1", {
      userId: "user-2",
      sessionId: "session-1",
      status: "idle",
      lastSeenAt: new Date("2024-01-01T00:05:00Z"),
    });

    const snapshot = presenceManager.list("workspace-1");
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]?.userId).toBe("user-2");
    expect(events.at(-1)?.count).toBe(2);

    presenceManager.remove("workspace-1", "user-1");
    expect(presenceManager.list("workspace-1")).toHaveLength(1);
    unsubscribe();
  });
});
