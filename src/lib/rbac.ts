type Role = "superadmin" | "admin" | "editor" | "writer";

type Actor = { id: string; role: Role; isActive?: boolean } | null | undefined;

type Resource = { authorId?: string } | undefined;

export type { Role };

export const ROLE_PRIORITY: Record<Role, number> = {
  superadmin: 4,
  admin: 3,
  editor: 2,
  writer: 1,
};

const ADMIN_BLOCKED_ACTIONS = new Set(["analytics:view"]);
const USER_ACTION_PREFIX = "user:";

export function resolveHighestRole(rawRoles: Iterable<string> | null | undefined): Role {
  let current: Role = "writer";

  if (!rawRoles) {
    return current;
  }

  const alias: Record<string, Role> = {
    owner: 'superadmin',
    administrator: 'admin',
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

  if (role === "editor") {
    if (action.startsWith(USER_ACTION_PREFIX)) return false;
    if (action === "analytics:view") return false;
    if (action.startsWith("post:")) return true;
    if (action.startsWith("page:")) return true;
    if (action === "ai:use") return true;
    return false;
  }

  if (role === "writer") {
    const own = resource?.authorId === user.id;
    if (action === "post:create") return true;
    if (action === "post:update" || action === "post:delete") {
      return own;
    }
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
