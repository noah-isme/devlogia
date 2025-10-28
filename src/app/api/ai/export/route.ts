import { NextResponse } from "next/server";
import { z } from "zod";

import { markdownToReportBuffer } from "@/lib/pdf";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";

const schema = z.object({
  content: z.string().min(5),
  format: z.enum(["md", "pdf"]).default("md"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const format = parsed.data.format === "pdf" ? "pdf" : "markdown";
  const { buffer, contentType } = markdownToReportBuffer(parsed.data.content, format === "pdf" ? "pdf" : "markdown");
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=ai-export.${format === "pdf" ? "pdf" : "md"}`,
    },
  });
}
