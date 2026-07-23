import crypto from "node:crypto";

export type ApiKeyScope =
  | "posts:read"
  | "posts:write"
  | "analytics:read"
  | "federation:sync"
  | "ai:use"
  | "webhooks:trigger"
  | "admin:full";

export const AVAILABLE_SCOPES: Array<{ scope: ApiKeyScope; label: string; description: string }> = [
  { scope: "posts:read", label: "Read Posts", description: "Access published posts and content via API" },
  { scope: "posts:write", label: "Write Posts", description: "Create and edit posts & drafts" },
  { scope: "analytics:read", label: "Read Analytics", description: "Access analytics, visits, and reader insights" },
  { scope: "federation:sync", label: "Federation Sync", description: "Publish and sync posts with federation network" },
  { scope: "ai:use", label: "AI Assistant", description: "Access AI writer, translator, and summarizer tools" },
  { scope: "webhooks:trigger", label: "Webhooks", description: "Trigger outbound webhooks and event listeners" },
  { scope: "admin:full", label: "Full Admin", description: "Unrestricted administrative access to all APIs" },
];

export type ApiKeyRecord = {
  id: string;
  name: string;
  key: string; // Plaintext or masked
  displayKey: string; // e.g. devlogia_sk_...a3f1
  scopes: ApiKeyScope[];
  source: "env" | "managed";
  status: "active" | "revoked";
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

// In-memory token store for dynamically issued keys during process runtime
const managedKeysStore = new Map<string, ApiKeyRecord>();

/**
 * Loads API keys defined in environment variables.
 */
export function getEnvApiKeys(): ApiKeyRecord[] {
  const envKeys: ApiKeyRecord[] = [];

  // 1. Sandbox API Key
  if (process.env.DEVPORTAL_SANDBOX_API_KEY) {
    const rawKey = process.env.DEVPORTAL_SANDBOX_API_KEY;
    envKeys.push({
      id: "env_sandbox_key",
      name: "DevPortal Sandbox API Key (ENV)",
      key: rawKey,
      displayKey: maskKey(rawKey),
      scopes: ["posts:read", "ai:use"],
      source: "env",
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: null,
      lastUsedAt: null,
    });
  }

  // 2. Federation API Key
  if (process.env.FEDERATION_API_KEY) {
    const rawKey = process.env.FEDERATION_API_KEY;
    envKeys.push({
      id: "env_federation_key",
      name: "Federation Network Key (ENV)",
      key: rawKey,
      displayKey: maskKey(rawKey),
      scopes: ["federation:sync", "posts:read"],
      source: "env",
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: null,
      lastUsedAt: null,
    });
  }

  // 3. SDK Token
  if (process.env.DEVLOGIA_SDK_TOKEN) {
    const rawKey = process.env.DEVLOGIA_SDK_TOKEN;
    envKeys.push({
      id: "env_sdk_token",
      name: "Devlogia SDK Access Token (ENV)",
      key: rawKey,
      displayKey: maskKey(rawKey),
      scopes: ["posts:read", "posts:write", "analytics:read"],
      source: "env",
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: null,
      lastUsedAt: null,
    });
  }

  // 4. Custom Env API Keys (JSON or CSV format)
  if (process.env.DEVLOGIA_API_KEYS || process.env.API_KEYS) {
    const customKeysRaw = process.env.DEVLOGIA_API_KEYS || process.env.API_KEYS || "";
    try {
      if (customKeysRaw.startsWith("[")) {
        const parsed = JSON.parse(customKeysRaw) as Array<{ name?: string; key: string; scopes?: ApiKeyScope[] }>;
        parsed.forEach((item, idx) => {
          if (item.key) {
            envKeys.push({
              id: `env_custom_${idx}`,
              name: item.name || `Custom Env Key #${idx + 1}`,
              key: item.key,
              displayKey: maskKey(item.key),
              scopes: item.scopes ?? ["posts:read"],
              source: "env",
              status: "active",
              createdAt: new Date().toISOString(),
              expiresAt: null,
              lastUsedAt: null,
            });
          }
        });
      } else {
        customKeysRaw.split(",").forEach((keyStr, idx) => {
          const trimmed = keyStr.trim();
          if (trimmed) {
            envKeys.push({
              id: `env_custom_${idx}`,
              name: `Env Key #${idx + 1}`,
              key: trimmed,
              displayKey: maskKey(trimmed),
              scopes: ["posts:read", "posts:write"],
              source: "env",
              status: "active",
              createdAt: new Date().toISOString(),
              expiresAt: null,
              lastUsedAt: null,
            });
          }
        });
      }
    } catch {
      // Fallback ignore parse errors
    }
  }

  return envKeys;
}

/**
 * Returns all active environment and managed API keys.
 */
export function getAllApiKeys(): ApiKeyRecord[] {
  const envKeys = getEnvApiKeys();
  const managedKeys = Array.from(managedKeysStore.values());
  return [...envKeys, ...managedKeys];
}

/**
 * Issues a new scoped API key.
 */
export function issueApiKey(options: {
  name: string;
  scopes: ApiKeyScope[];
  expiresDays?: number | null;
}): { record: ApiKeyRecord; secretKey: string } {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const secretKey = `devlogia_sk_${randomBytes}`;
  const id = `key_${crypto.randomBytes(8).toString("hex")}`;

  const createdAt = new Date();
  let expiresAt: string | null = null;
  if (options.expiresDays && options.expiresDays > 0) {
    const expDate = new Date(createdAt.getTime() + options.expiresDays * 24 * 60 * 60 * 1000);
    expiresAt = expDate.toISOString();
  }

  const record: ApiKeyRecord = {
    id,
    name: options.name.trim() || "API Key",
    key: secretKey,
    displayKey: maskKey(secretKey),
    scopes: options.scopes.length > 0 ? options.scopes : ["posts:read"],
    source: "managed",
    status: "active",
    createdAt: createdAt.toISOString(),
    expiresAt,
    lastUsedAt: null,
  };

  managedKeysStore.set(id, record);

  return { record, secretKey };
}

/**
 * Revokes a managed API key.
 */
export function revokeApiKey(id: string): boolean {
  const record = managedKeysStore.get(id);
  if (!record) {
    return false;
  }
  record.status = "revoked";
  managedKeysStore.set(id, record);
  return true;
}

/**
 * Verifies if an incoming API key string is valid and possesses the required scope.
 */
export function verifyApiKey(key: string, requiredScope?: ApiKeyScope): { valid: boolean; record?: ApiKeyRecord; reason?: string } {
  if (!key) {
    return { valid: false, reason: "Missing API key" };
  }

  const allKeys = getAllApiKeys();
  const matched = allKeys.find((k) => k.key === key.trim() && k.status === "active");

  if (!matched) {
    return { valid: false, reason: "Invalid or revoked API key" };
  }

  if (matched.expiresAt && new Date(matched.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: "API key has expired" };
  }

  if (requiredScope && !matched.scopes.includes("admin:full") && !matched.scopes.includes(requiredScope)) {
    return { valid: false, reason: `API key lacks required scope: ${requiredScope}` };
  }

  matched.lastUsedAt = new Date().toISOString();
  return { valid: true, record: matched };
}

function maskKey(key: string): string {
  if (key.length <= 8) {
    return "••••••••";
  }
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
