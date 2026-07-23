import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getAllApiKeys, issueApiKey, type ApiKeyScope } from "@/lib/security/api-keys";

const issueKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  expiresDays: z.number().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "superadmin" && session.user.role !== "admin" && session.user.role !== "tenantAdmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = getAllApiKeys().map((k) => ({
    ...k,
    key: k.displayKey, // Hide full secret key in list view
  }));

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "superadmin" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = issueKeySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, scopes, expiresDays } = parsed.data;

  const result = issueApiKey({
    name,
    scopes: scopes as ApiKeyScope[],
    expiresDays,
  });

  return NextResponse.json(
    {
      message: "Scoped API key issued successfully",
      record: {
        ...result.record,
        key: result.record.displayKey,
      },
      secretKey: result.secretKey, // Returned ONCE upon issuance
    },
    { status: 201 },
  );
}
