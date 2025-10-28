import { describe, expect, it } from "vitest";

import { can, resolveHighestRole } from "@/lib/rbac";

describe("rbac permissions", () => {
  const superadmin = { id: "superadmin", role: "superadmin" as const };
  const tenantAdmin = { id: "tenant-admin", role: "tenantAdmin" as const };
  const admin = { id: "admin", role: "admin" as const };
  const editor = { id: "editor", role: "editor" as const };
  const writer = { id: "writer", role: "writer" as const };
  const viewer = { id: "viewer", role: "viewer" as const };
  const other = { id: "other", role: "writer" as const };

  it("allows superadmins to perform any action", () => {
    expect(can(superadmin, "post:create")).toBe(true);
    expect(can(superadmin, "user:update")).toBe(true);
    expect(can(superadmin, "analytics:view")).toBe(true);
  });

  it("prevents admins from managing users and analytics", () => {
    expect(can(admin, "post:create")).toBe(true);
    expect(can(admin, "user:update")).toBe(false);
    expect(can(admin, "analytics:view")).toBe(false);
  });

  it("allows tenant admins to control tenant-scoped actions", () => {
    expect(can(tenantAdmin, "tenant:update-domain")).toBe(true);
    expect(can(tenantAdmin, "billing:sync-plan")).toBe(true);
    expect(can(tenantAdmin, "analytics:view")).toBe(true);
    expect(can(tenantAdmin, "user:invite")).toBe(true);
    expect(can(tenantAdmin, "user:delete")).toBe(false);
  });

  it("allows editors to manage content but not users", () => {
    expect(can(editor, "post:update")).toBe(true);
    expect(can(editor, "page:delete")).toBe(true);
    expect(can(editor, "user:update")).toBe(false);
  });

  it("allows writers to manage their own posts only", () => {
    expect(can(writer, "post:create")).toBe(true);
    expect(can(writer, "post:update", { authorId: writer.id })).toBe(true);
    expect(can(writer, "post:update", { authorId: other.id })).toBe(false);
    expect(can(writer, "post:delete", { authorId: writer.id })).toBe(true);
    expect(can(writer, "post:delete", { authorId: other.id })).toBe(false);
  });

  it("restricts viewers to read-only operations", () => {
    expect(can(viewer, "analytics:view")).toBe(true);
    expect(can(viewer, "post:view:list")).toBe(true);
    expect(can(viewer, "post:create")).toBe(false);
  });

  it("blocks inactive actors", () => {
    expect(can({ id: "inactive", role: "admin", isActive: false }, "post:create")).toBe(false);
  });

  it("resolves viewer as the baseline role", () => {
    expect(resolveHighestRole(null)).toBe("viewer");
    expect(resolveHighestRole(["tenantadmin", "writer"])).toBe("tenantAdmin");
  });
});
