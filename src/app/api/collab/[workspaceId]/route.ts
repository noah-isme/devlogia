import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createCollaborationResponse } from "@/lib/collaboration/socket";

export const runtime = "nodejs";

const unauthorized = () => new Response("Unauthorized", { status: 401 });
const forbidden = () => new Response("Forbidden", { status: 403 });

type RouteContext = {
  params: Promise<{ workspaceId: string }> | { workspaceId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:collaborate")) {
    return forbidden();
  }
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  const params = await context.params;
  const workspaceId = params?.workspaceId;
  if (!workspaceId) {
    return new Response("Invalid workspace", { status: 400 });
  }
  try {
    return await createCollaborationResponse({ workspaceId, userId: session.user.id });
  } catch (error) {
    logger.error({ err: error, workspaceId }, "Failed to establish collaboration session");
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Failed to open collaboration channel";
    return new Response(message, { status });
  }
}
