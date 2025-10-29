import { beforeAll, describe, expect, it } from "vitest";

import { decryptAuditField, encryptAuditField } from "@/lib/security/audit-encryption";

describe("audit encryption", () => {
  beforeAll(() => {
    process.env.AUDIT_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  });

  it("encrypts and decrypts strings", () => {
    const payload = "sensitive audit trail";
    const encrypted = encryptAuditField(payload);
    expect(encrypted).not.toEqual(payload);
    const decrypted = decryptAuditField(encrypted);
    expect(decrypted).toEqual(payload);
  });
});
