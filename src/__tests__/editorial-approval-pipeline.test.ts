import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";
import { postStatusValues } from "@/lib/validations/post";

describe("Editorial Approval Pipeline", () => {
  it("includes all lifecycle statuses in postStatusValues schema", () => {
    expect(postStatusValues).toContain("DRAFT");
    expect(postStatusValues).toContain("IN_REVIEW");
    expect(postStatusValues).toContain("CHANGES_REQUESTED");
    expect(postStatusValues).toContain("APPROVED");
    expect(postStatusValues).toContain("PUBLISHED");
    expect(postStatusValues).toContain("SCHEDULED");
  });

  describe("RBAC Permissions for Editorial Workflow", () => {
    it("allows writers to submit their own posts for review", () => {
      const writerUser = { id: "user_writer_1", role: "writer" as const, isActive: true };
      const ownResource = { authorId: "user_writer_1" };
      const otherResource = { authorId: "user_writer_2" };

      expect(can(writerUser, "post:submit_review", ownResource)).toBe(true);
      expect(can(writerUser, "post:submit_review", otherResource)).toBe(false);
    });

    it("prevents writers from publishing posts directly", () => {
      const writerUser = { id: "user_writer_1", role: "writer" as const, isActive: true };
      const ownResource = { authorId: "user_writer_1" };

      // Writers cannot perform publish action
      expect(can(writerUser, "post:publish", ownResource)).toBe(false);
    });

    it("allows editors and admins to review, request changes, approve, and publish posts", () => {
      const editorUser = { id: "user_editor_1", role: "editor" as const, isActive: true };
      const adminUser = { id: "user_admin_1", role: "admin" as const, isActive: true };

      expect(can(editorUser, "post:update")).toBe(true);
      expect(can(editorUser, "post:review")).toBe(true);
      expect(can(editorUser, "post:approve")).toBe(true);
      expect(can(adminUser, "post:publish")).toBe(true);
    });
  });
});
