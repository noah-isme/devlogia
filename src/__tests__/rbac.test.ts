import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";

describe("rbac permissions", () => {
  const owner = { id: "owner", role: "owner" as const };
  const editor = { id: "editor", role: "editor" as const };
  const writer = { id: "writer", role: "writer" as const };
  const other = { id: "other", role: "writer" as const };

  it("allows owners to perform any action", () => {
    expect(can(owner, "post:create")).toBe(true);
    expect(can(owner, "user:update")).toBe(true);
    expect(can(owner, "ai:use")).toBe(true);
  });

  it("blocks editors from managing users", () => {
    expect(can(editor, "post:update")).toBe(true);
    expect(can(editor, "user:update")).toBe(false);
  });

  it("allows writers to create posts but not manage others", () => {
    expect(can(writer, "post:create")).toBe(true);
    expect(can(writer, "post:update", { authorId: writer.id })).toBe(true);
    expect(can(writer, "post:update", { authorId: other.id })).toBe(false);
    expect(can(writer, "post:delete", { authorId: writer.id })).toBe(true);
    expect(can(writer, "post:delete", { authorId: other.id })).toBe(false);
  });

  it("prevents writers from using AI endpoints", () => {
    expect(can(writer, "ai:use")).toBe(false);
  });
});
