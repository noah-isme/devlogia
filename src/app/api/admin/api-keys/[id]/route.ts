import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeApiKey } from "@/lib/security/api-keys";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "superadmin" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id.startsWith("env_")) {
    return NextResponse.json({ error: "Environment API keys cannot be revoked via API. Remove them from process.env." }, { status: 400 });
  }

  const success = revokeApiKey(id);
  if (!success) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "API key revoked successfully" });
}
