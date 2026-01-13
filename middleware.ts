/**
 * Edge-compatible middleware for authentication.
 *
 * ARCHITECTURE NOTE:
 * This middleware runs on the Edge Runtime which has limited Node.js API support.
 * The following are NOT available in Edge middleware:
 * - pino logger (uses Node.js streams)
 * - ioredis (uses Node.js net module)
 * - fs, path, or other Node.js-specific modules
 *
 * For these features, use API routes with `export const runtime = 'nodejs'`
 *
 * This middleware handles:
 * - Admin route protection via JWT verification
 * - Admin API route protection
 *
 * Page-level protection is still implemented as a fallback for defense-in-depth.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_ROUTES = ["/admin"];
const ADMIN_API_ROUTES = ["/api/admin"];
const PUBLIC_ADMIN_ROUTES = ["/admin/login"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.some((route) => pathname.startsWith(route));
}

function isProtectedAdminRoute(pathname: string): boolean {
  return (
    ADMIN_ROUTES.some((route) => pathname.startsWith(route)) ||
    ADMIN_API_ROUTES.some((route) => pathname.startsWith(route))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedAdminRoute(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[Middleware] No AUTH_SECRET or NEXTAUTH_SECRET configured");
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const token = await getToken({
    req: request,
    secret,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.isActive === false) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    return NextResponse.redirect(
      new URL("/admin/login?error=disabled", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
