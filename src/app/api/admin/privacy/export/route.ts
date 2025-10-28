import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { exportUserInsights } from "@/lib/personalization/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payload = await exportUserInsights(session.user.id);
  return NextResponse.json(payload ?? {});
}
