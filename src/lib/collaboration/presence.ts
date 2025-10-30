import { EventEmitter } from "node:events";

export type PresenceStatus = "online" | "idle" | "disconnected";

export type PresenceRecord = {
  userId: string;
  sessionId: string;
  status: PresenceStatus;
  lastSeenAt: Date;
};

export type PresenceEvent = {
  workspaceId: string;
  presence: PresenceRecord[];
};

type PresenceStateMap = Map<string, Map<string, PresenceRecord>>;

type PresenceListener = (event: PresenceEvent) => void;

class PresenceManager extends EventEmitter {
  private readonly state: PresenceStateMap = new Map();

  constructor() {
    super();
    this.setMaxListeners(0);
  }

  update(workspaceId: string, record: PresenceRecord) {
    const workspaceState = this.state.get(workspaceId) ?? new Map<string, PresenceRecord>();
    workspaceState.set(record.userId, { ...record, lastSeenAt: new Date(record.lastSeenAt) });
    this.state.set(workspaceId, workspaceState);
    this.emitPresence(workspaceId);
  }

  remove(workspaceId: string, userId: string) {
    const workspaceState = this.state.get(workspaceId);
    if (!workspaceState) {
      return;
    }
    workspaceState.delete(userId);
    if (workspaceState.size === 0) {
      this.state.delete(workspaceId);
    }
    this.emitPresence(workspaceId);
  }

  list(workspaceId: string): PresenceRecord[] {
    const workspaceState = this.state.get(workspaceId);
    if (!workspaceState) {
      return [];
    }
    return Array.from(workspaceState.values())
      .map((record) => ({ ...record, lastSeenAt: new Date(record.lastSeenAt) }))
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  subscribe(workspaceId: string, listener: PresenceListener) {
    const channel = this.channel(workspaceId);
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }

  private emitPresence(workspaceId: string) {
    const channel = this.channel(workspaceId);
    const presence = this.list(workspaceId);
    this.emit(channel, { workspaceId, presence } satisfies PresenceEvent);
  }

  private channel(workspaceId: string) {
    return `presence:${workspaceId}`;
  }
}

export const presenceManager = new PresenceManager();
