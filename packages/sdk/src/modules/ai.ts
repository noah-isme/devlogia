import { HttpClient } from "../client";

export type SdkAIExtension = {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  capability: string;
  tokenCost: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  active: boolean;
  monthlyTokens: number;
  monthlyCostCents: number;
  totalInvocations: number;
};

export type SdkQuotaWarning = {
  level: "warning" | "critical";
  threshold: number;
  utilization: number;
  message: string;
};

export type SdkQuotaStatus = {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number;
  warnings: SdkQuotaWarning[];
};

export type SdkUsageResponse = {
  logId: string | null;
  quota: SdkQuotaStatus;
  warnings: SdkQuotaWarning[];
};

export type SdkWorkspaceMember = {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; email: string };
};

export type SdkPresenceState = {
  userId: string;
  status: string;
  lastSeenAt: string | null;
};

export type SdkWorkspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: SdkWorkspaceMember[];
  sessions: Array<{
    id: string;
    startedAt: string;
    active: boolean;
    presence: SdkPresenceState[];
  }>;
};

export class AIModule {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async listExtensions(options: { tenantId: string; includeInactive?: boolean } | { tenantId: string }) {
    const params = new URLSearchParams({ tenantId: options.tenantId });
    if ("includeInactive" in options && options.includeInactive) {
      params.set("includeInactive", "true");
    }
    const response = await this.client.request<{ extensions: SdkAIExtension[] }>(`/api/ai/extensions?${params.toString()}`);
    return response.extensions;
  }

  async createExtension(payload: Record<string, unknown>) {
    const response = await this.client.request<{ extension: SdkAIExtension }>(`/api/ai/extensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.extension;
  }

  async logUsage(payload: Record<string, unknown>) {
    const response = await this.client.request<SdkUsageResponse>(`/api/ai/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response;
  }

  async listWorkspaces(options: { tenantId: string }) {
    const params = new URLSearchParams({ tenantId: options.tenantId });
    const response = await this.client.request<{ workspaces: SdkWorkspace[] }>(`/api/workspaces?${params.toString()}`);
    return response.workspaces;
  }

  async createWorkspace(payload: Record<string, unknown>) {
    const response = await this.client.request<{ workspace: SdkWorkspace }>(`/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.workspace;
  }
}
