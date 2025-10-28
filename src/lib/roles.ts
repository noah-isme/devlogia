import { RoleName } from "@prisma/client";

import type { Role } from "@/lib/rbac";

export const ROLE_TO_ENUM: Record<Role, RoleName> = {
  superadmin: RoleName.SUPERADMIN,
  tenantAdmin: RoleName.TENANTADMIN,
  admin: RoleName.ADMIN,
  editor: RoleName.EDITOR,
  writer: RoleName.WRITER,
  viewer: RoleName.VIEWER,
};

const ROLE_FROM_ENUM: Record<RoleName, Role> = {
  [RoleName.SUPERADMIN]: "superadmin",
  [RoleName.TENANTADMIN]: "tenantAdmin",
  [RoleName.ADMIN]: "admin",
  [RoleName.EDITOR]: "editor",
  [RoleName.WRITER]: "writer",
  [RoleName.VIEWER]: "viewer",
};

export function fromRoleName(name: RoleName): Role {
  return ROLE_FROM_ENUM[name];
}

export function toRoleName(role: Role): RoleName {
  return ROLE_TO_ENUM[role];
}
