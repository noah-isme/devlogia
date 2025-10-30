type Role = "superadmin" | "tenantAdmin" | "admin" | "editor" | "writer" | "viewer";

type Actor = { id: string; role: Role; isActive?: boolean } | null | undefined;

type Resource = { authorId?: string } | undefined;

export type { Role };

export const ROLE_PRIORITY: Record<Role, number> = {
  superadmin: 5,
  admin: 4,
  tenantAdmin: 3,
  editor: 2,
  writer: 1,
  viewer: 0,
};

const ADMIN_BLOCKED_ACTIONS = new Set(["analytics:view"]);
const TENANT_ADMIN_USER_ACTIONS = new Set([
  "user:list",
  "user:create",
  "user:update",
  "user:invite",
  "user:activate",
  "user:deactivate",
]);
const VIEWER_ALLOWED_ACTIONS = new Set(["analytics:view", "insights:view", "federation:view"]);
const WORKSPACE_WRITER_ACTIONS = new Set(["workspace:view", "workspace:join", "workspace:presence:update"]);
const EDITOR_ALLOWED_ACTIONS = new Set([
  "workspace:view",
  "workspace:collaborate",
  "workspace:presence:update",
  "ai:extensions:view",
]);
const USER_ACTION_PREFIX = "user:";

function actionStartsWith(action: string, prefixes: string[]) {
  return prefixes.some((prefix) => action.startsWith(prefix));
}

export function resolveHighestRole(rawRoles: Iterable<string> | null | undefined): Role {
  let current: Role = "viewer";

  if (!rawRoles) {
    return current;
  }

  const alias: Record<string, Role> = {
    owner: "superadmin",
    administrator: "admin",
    tenant_admin: "tenantAdmin",
    tenantadmin: "tenantAdmin",
  };

  for (const value of rawRoles) {
    if (!value) continue;
    const lower = value.toLowerCase();
    const normalized = (alias[lower] ?? lower) as Role;
    if (normalized in ROLE_PRIORITY && ROLE_PRIORITY[normalized] > ROLE_PRIORITY[current]) {
      current = normalized;
    }
  }

  return current;
}

export function can(user: Actor, action: string, resource?: Resource) {
  if (!user || user.isActive === false) return false;
  const { role } = user;
  if (role === "superadmin") return true;

  if (role === "admin") {
    if (action.startsWith(USER_ACTION_PREFIX)) return false;
    if (ADMIN_BLOCKED_ACTIONS.has(action)) return false;
    return true;
  }

  if (role === "tenantAdmin") {
    if (action.startsWith(USER_ACTION_PREFIX)) {
      return TENANT_ADMIN_USER_ACTIONS.has(action);
    }

    if (
      actionStartsWith(action, [
        "tenant:",
        "billing:",
        "post:",
        "page:",
        "media:",
        "ai:",
        "ai:extensions:",
        "insights:",
        "analytics:",
        "federation:",
        "workspace:",
      ])
    ) {
      return true;
    }

    return false;
  }

  if (role === "editor") {
    if (action.startsWith(USER_ACTION_PREFIX)) return false;
    if (action === "analytics:view") return false;
    if (actionStartsWith(action, ["post:", "page:", "media:"])) return true;
    if (action === "ai:use") return true;
    if (EDITOR_ALLOWED_ACTIONS.has(action)) return true;
    return false;
  }

  if (role === "writer") {
    const own = resource?.authorId === user.id;
    if (action === "post:create") return true;
    if (action === "post:update" || action === "post:delete") {
      return own;
    }
    if (action === "ai:use") return true;
    if (WORKSPACE_WRITER_ACTIONS.has(action)) return true;
    return false;
  }

  if (role === "viewer") {
    if (VIEWER_ALLOWED_ACTIONS.has(action)) return true;
    if (actionStartsWith(action, ["post:view", "page:view"])) return true;
    return false;
  }

  return false;
}

export function assertCan(user: Actor, action: string, resource?: Resource) {
  if (!can(user, action, resource)) {
    const error = new Error("Forbidden");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}
