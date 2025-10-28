import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";

describe("rbac permissions", () => {
  const superadmin = { id: "superadmin", role: "superadmin" as const };
  const admin = { id: "admin", role: "admin" as const };
  const editor = { id: "editor", role: "editor" as const };
  const writer = { id: "writer", role: "writer" as const };
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

  it("blocks inactive actors", () => {
    expect(can({ id: "inactive", role: "admin", isActive: false }, "post:create")).toBe(false);
  });
});
