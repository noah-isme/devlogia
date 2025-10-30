import { createHmac, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  url: z.string().url(),
  event: z.string().min(1),
  payload: z.unknown().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  nonce: z.string().optional(),
});

type ReplayEntry = {
  nonce: string;
  expiresAt: number;
};

const replayStore: ReplayEntry[] = [];

function getSigningKey() {
  const key = process.env.WEBHOOK_SIGNING_KEY;
  if (!key) {
    throw new Error("WEBHOOK_SIGNING_KEY is not configured");
  }
  return key;
}

function generateNonce() {
  return randomBytes(12).toString("hex");
}

function registerNonce(nonce: string, ttlMs: number) {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  // remove expired entries
  for (let index = replayStore.length - 1; index >= 0; index -= 1) {
    if (replayStore[index].expiresAt <= now) {
      replayStore.splice(index, 1);
    }
  }

  if (replayStore.some((entry) => entry.nonce === nonce && entry.expiresAt > now)) {
    return false;
  }

  replayStore.push({ nonce, expiresAt });
  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  const ttlSeconds = Number(process.env.WEBHOOK_REPLAY_TTL_SEC ?? "300");
  const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 300_000;
  const nonce = parsed.data.nonce ?? generateNonce();

  const registered = registerNonce(nonce, ttlMs);
  if (!registered) {
    return NextResponse.json({ error: "Replay detected" }, { status: 409 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  let signingKey: string;
  try {
    signingKey = getSigningKey();
  } catch (error) {
    console.error("Webhook signing key missing", error);
    return NextResponse.json({ error: "Webhook signing key missing" }, { status: 500 });
  }

  const envelope = {
    event: parsed.data.event,
    payload: parsed.data.payload ?? {},
    timestamp,
    nonce,
  };
  const serialized = JSON.stringify(envelope);
  const signature = createHmac("sha256", signingKey).update(serialized).digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const started = performance.now();

  try {
    const response = await fetch(parsed.data.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-devlogia-signature": signature,
        "x-devlogia-timestamp": timestamp,
        "x-devlogia-nonce": nonce,
        ...parsed.data.headers,
      },
      body: serialized,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latencyMs = performance.now() - started;
    const text = await response.text();
    const excerpt = text.length > 2000 ? `${text.slice(0, 2000)}…` : text;

    return NextResponse.json({
      result: {
        status: response.status,
        latencyMs,
        body: excerpt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error("Failed to dispatch webhook", error);
    return NextResponse.json({ error: "Failed to dispatch webhook" }, { status: 422 });
  }
}
