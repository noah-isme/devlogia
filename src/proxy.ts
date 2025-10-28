import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { logger } from "@/lib/logger";

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' data: blob: https://*.supabase.co",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.supabase.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const start = Date.now();
  let response: NextResponse | null = null;

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      if (!token) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
        response = NextResponse.redirect(loginUrl);
        return response;
      }
    }

    if (pathname === "/admin/login" && token) {
      response = NextResponse.redirect(new URL("/admin/dashboard", request.url));
      return response;
    }

    response = NextResponse.next();
    return response;
  } finally {
    if (response) {
      applySecurityHeaders(response);
      const durationMs = Date.now() - start;
      logger.info({ path: pathname, method: request.method, status: response.status, durationMs }, "Request completed");
    }
  }
}
