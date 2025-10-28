type Role = "owner" | "editor" | "writer";

type Actor = { id: string; role: Role } | null | undefined;

type Resource = { authorId?: string } | undefined;

export type { Role };

export function can(user: Actor, action: string, resource?: Resource) {
  if (!user) return false;
  const { role } = user;
  if (role === "owner") return true;
  if (role === "editor") return !action.startsWith("user");
  if (role === "writer") {
    const own = resource?.authorId === user.id;
    return action === "post:create" || (own && ["post:update", "post:delete"].includes(action));
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
