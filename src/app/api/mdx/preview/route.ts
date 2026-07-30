import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { renderMdx } from "@/lib/mdx";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const element = await renderMdx(body.content);
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(element);
    return NextResponse.json({ html });
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 500) : "Invalid MDX syntax";
    return NextResponse.json({ error: "Unable to render MDX", detail }, { status: 422 });
  }
}
