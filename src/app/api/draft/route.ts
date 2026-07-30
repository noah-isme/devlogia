import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/seo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug");

  const expectedSecret = process.env.DRAFT_PREVIEW_SECRET || "devlogia-draft-secret-token";

  if (!secret || secret !== expectedSecret) {
    return new NextResponse("Invalid or expired draft preview token", { status: 401 });
  }

  if (!slug) {
    return new NextResponse("Missing article slug parameter", { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url || "http://localhost:3001";
  const redirectUrl = new URL(`/blog/${encodeURIComponent(slug)}`, baseUrl);
  redirectUrl.searchParams.set("preview", "true");

  const response = NextResponse.redirect(redirectUrl);
  // Set 24-hour preview authorization cookie
  response.cookies.set("devlogia_draft_preview", secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  });

  return response;
}
