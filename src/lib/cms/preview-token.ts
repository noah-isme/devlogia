import { createHmac, timingSafeEqual } from "node:crypto";

const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;

type DraftPreviewTokenPayload = {
  readonly postId: string;
  readonly expiresAt: string;
};

type DraftPreviewTokenResult = {
  readonly token: string;
  readonly expiresAt: string;
};

function getPreviewSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET");
  }
  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getPreviewSecret()).update(encodedPayload).digest("base64url");
}

export function createDraftPreviewToken(postId: string, now = new Date()): DraftPreviewTokenResult {
  const expiresAt = new Date(now.getTime() + PREVIEW_TOKEN_TTL_MS).toISOString();
  const encodedPayload = Buffer.from(JSON.stringify({ postId, expiresAt } satisfies DraftPreviewTokenPayload)).toString(
    "base64url",
  );
  const signature = signPayload(encodedPayload);
  return { token: `${encodedPayload}.${signature}`, expiresAt };
}

export function verifyDraftPreviewToken(token: string, postId: string, now = new Date()) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload);
  const received = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null || !("postId" in payload) || !("expiresAt" in payload)) {
      return false;
    }

    return payload.postId === postId && typeof payload.expiresAt === "string" && new Date(payload.expiresAt).getTime() > now.getTime();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}
