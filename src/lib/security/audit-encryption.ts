import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey() {
  const key = process.env.AUDIT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("AUDIT_ENCRYPTION_KEY is required for audit log encryption");
  }
  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) {
    throw new Error("AUDIT_ENCRYPTION_KEY must be a base64 encoded 32-byte key");
  }
  return buffer;
}

export function encryptAuditField(plaintext: string) {
  if (!plaintext) {
    return plaintext;
  }
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptAuditField(payload: string | null) {
  if (!payload) {
    return payload;
  }
  const [version, ivB64, cipherB64, tagB64] = payload.split(":");
  if (version !== VERSION) {
    throw new Error(`Unsupported audit log payload version: ${version}`);
  }
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
