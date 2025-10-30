import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { presenceManager } from "@/lib/collaboration/presence";
import {
  disconnectPresence,
  ensureWorkspaceMember,
  startWorkspaceSession,
  updatePresence,
} from "@/lib/collaboration/workspace";

const workspaceSockets = new Map<string, { sockets: Set<WebSocket>; unsubscribe: () => void }>();

function ensureSubscription(workspaceId: string) {
  const existing = workspaceSockets.get(workspaceId);
  if (existing) {
    return existing;
  }
  const sockets = new Set<WebSocket>();
  const unsubscribe = presenceManager.subscribe(workspaceId, (event) => {
    const payload = JSON.stringify({ type: "presence", data: event.presence });
    for (const socket of sockets) {
      try {
        socket.send(payload);
      } catch (error) {
        logger.warn({ error, workspaceId }, "Failed to broadcast presence update");
      }
    }
  });
  const entry = { sockets, unsubscribe } as const;
  workspaceSockets.set(workspaceId, entry);
  return entry;
}

function removeSocket(workspaceId: string, socket: WebSocket) {
  const entry = workspaceSockets.get(workspaceId);
  if (!entry) {
    return;
  }
  entry.sockets.delete(socket);
  if (entry.sockets.size === 0) {
    entry.unsubscribe();
    workspaceSockets.delete(workspaceId);
  }
}

type SocketContext = {
  workspaceId: string;
  sessionId: string;
  userId: string;
};

type ClientMessage =
  | { type: "presence"; status?: "online" | "idle" | "disconnected" }
  | { type: "ping" }
  | { type: "broadcast"; event: string; payload?: unknown };

function parseMessage(event: MessageEvent): ClientMessage | null {
  if (typeof event.data !== "string") {
    return null;
  }
  try {
    const data = JSON.parse(event.data) as ClientMessage;
    if (!data || typeof data !== "object" || typeof (data as { type?: unknown }).type !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function handlePresenceMessage(context: SocketContext, message: ClientMessage) {
  const status = message.type === "presence" && message.status ? message.status : "online";
  await updatePresence({
    sessionId: context.sessionId,
    workspaceId: context.workspaceId,
    userId: context.userId,
    status,
  });
}

async function handleBroadcastMessage(context: SocketContext, message: Extract<ClientMessage, { type: "broadcast" }>) {
  const entry = workspaceSockets.get(context.workspaceId);
  if (!entry) {
    return;
  }
  const payload = JSON.stringify({
    type: "broadcast",
    event: message.event,
    payload: message.payload,
    actorId: context.userId,
  });
  for (const socket of entry.sockets) {
    try {
      socket.send(payload);
    } catch (error) {
      logger.warn({ error, workspaceId: context.workspaceId }, "Failed to dispatch collaboration broadcast");
    }
  }
}

function createWebSocketPair() {
  const globalPair = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: WebSocket } }).WebSocketPair;
  if (!globalPair) {
    throw new Error("WebSocketPair is not available in this runtime");
  }
  const pair = new globalPair();
  return { client: pair[0], server: pair[1] };
}

async function initializeSocket(socket: WebSocket, context: SocketContext) {
  const entry = ensureSubscription(context.workspaceId);
  entry.sockets.add(socket);
  const maybeAccept = (socket as WebSocket & { accept?: () => void }).accept;
  if (typeof maybeAccept === "function") {
    maybeAccept.call(socket);
  }
  await handlePresenceMessage(context, { type: "presence", status: "online" });
}

export async function createCollaborationResponse({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const membership = await ensureWorkspaceMember(workspaceId, userId);
  if (!membership) {
    const error = new Error("User is not a member of the workspace");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
  const session = await startWorkspaceSession(workspaceId);
  const sessionId = session?.id ?? randomUUID();
  const { client, server } = createWebSocketPair();
  const context: SocketContext = { workspaceId, sessionId, userId };
  await initializeSocket(server, context);
  server.addEventListener("message", (event) => {
    const parsed = parseMessage(event);
    if (!parsed) {
      return;
    }
    if (parsed.type === "ping") {
      server.send(JSON.stringify({ type: "pong" }));
      return;
    }
    if (parsed.type === "broadcast") {
      void handleBroadcastMessage(context, parsed);
      return;
    }
    if (parsed.type === "presence") {
      void handlePresenceMessage(context, parsed);
    }
  });
  const closeHandler = async () => {
    removeSocket(context.workspaceId, server);
    await disconnectPresence(context.workspaceId, context.sessionId, context.userId);
  };
  server.addEventListener("close", () => {
    void closeHandler();
  });
  server.addEventListener("error", (event) => {
    logger.error({ workspaceId, event }, "Collaboration socket error");
  });
  const init = { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket };
  return new Response(null, init);
}
