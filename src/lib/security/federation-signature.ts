import { createVerify } from "node:crypto";

import { logger } from "@/lib/logger";
import { recordSignatureVerification } from "@/lib/metrics/advanced";

export type SignatureInput = {
  method: string;
  path: string;
  body: string;
  timestamp: string;
  signature: string;
};

function getPublicKey() {
  const key = process.env.FEDERATION_SIGNING_PUBLIC_KEY;
  if (!key) {
    throw new Error("FEDERATION_SIGNING_PUBLIC_KEY is not configured");
  }
  return key;
}

export function buildSignaturePayload(input: SignatureInput) {
  return [input.method.toUpperCase(), input.path, input.timestamp, input.body].join("\n");
}

export function verifyFederationSignature(input: SignatureInput) {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(buildSignaturePayload(input));
    verifier.end();
    const isValid = verifier.verify(getPublicKey(), Buffer.from(input.signature, "base64"));
    recordSignatureVerification({ success: isValid });
    return isValid;
  } catch (error) {
    logger.error({ err: error }, "Federation signature verification failed");
    recordSignatureVerification({ success: false });
    return false;
  }
}
