import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getPrivacyPreferences, updatePrivacyPreferences } from "@/lib/personalization/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const preferences = await getPrivacyPreferences(session.user.id);
  return NextResponse.json(preferences);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json()) as Partial<{ personalizationOptOut: boolean; analyticsOptOut: boolean }>;
  const preferences = await updatePrivacyPreferences(session.user.id, {
    personalizationOptOut: body.personalizationOptOut,
    analyticsOptOut: body.analyticsOptOut,
  });
  return NextResponse.json(preferences);
}
