import { RoleName } from "@prisma/client";

import type { Role } from "@/lib/rbac";

export const ROLE_TO_ENUM: Record<Role, RoleName> = {
  superadmin: RoleName.SUPERADMIN,
  admin: RoleName.ADMIN,
  editor: RoleName.EDITOR,
  writer: RoleName.WRITER,
};

export function fromRoleName(name: RoleName): Role {
  return name.toLowerCase() as Role;
}

export function toRoleName(role: Role): RoleName {
  return ROLE_TO_ENUM[role];
}
