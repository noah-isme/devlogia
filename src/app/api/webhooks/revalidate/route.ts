import crypto from "crypto";
import { revalidatePath } from "next/cache";

import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`webhook:${ip}`, 60, 60_000);
  if (!rate.success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }

  const sig = req.headers.get("x-devlogia-signature");
  const secret = process.env.WEBHOOKS_SIGNING_SECRET;

  if (!secret) {
    return new Response("Missing signing secret", { status: 500 });
  }

  if (!sig) {
    return new Response("Missing signature", { status: 401 });
  }

  const body = await req.text();
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const valid = expected === sig;

  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const data = JSON.parse(body);
  if (data.slug) {
    revalidatePath(`/blog/${data.slug}`);
  } else {
    revalidatePath(`/`);
  }
  return Response.json({ revalidated: true });
}
