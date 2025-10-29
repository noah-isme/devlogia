import { beforeAll, describe, expect, it } from "vitest";
import { createSign, generateKeyPairSync } from "node:crypto";

import { buildSignaturePayload, verifyFederationSignature } from "@/lib/security/federation-signature";

describe("federation signature", () => {
  let privateKey: string;

  beforeAll(() => {
    const { privateKey: priv, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    privateKey = priv;
    process.env.FEDERATION_SIGNING_PUBLIC_KEY = publicKey;
  });

  it("verifies a valid signature", () => {
    const payload = {
      method: "POST",
      path: "/api/federation/query",
      timestamp: new Date().toISOString(),
      body: JSON.stringify({ query: "hello" }),
      signature: "",
    };
    const signer = createSign("RSA-SHA256");
    signer.update(buildSignaturePayload(payload));
    signer.end();
    payload.signature = signer.sign(privateKey).toString("base64");

    expect(verifyFederationSignature(payload)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const payload = {
      method: "POST",
      path: "/api/federation/query",
      timestamp: new Date().toISOString(),
      body: JSON.stringify({ query: "bad" }),
      signature: Buffer.from("invalid").toString("base64"),
    };

    expect(verifyFederationSignature(payload)).toBe(false);
  });
});
