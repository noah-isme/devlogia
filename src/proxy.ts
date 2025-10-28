import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { createRequestLogger } from "@/lib/logger";

const cspDirectives = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "media-src 'self' https:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const cspReportUri = process.env.CSP_REPORT_URI;
if (cspReportUri) {
  cspDirectives.push(`report-uri ${cspReportUri}`);
}

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": cspDirectives.join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function applySecurityHeaders(response: NextResponse, requestId: string) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set("x-request-id", requestId);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const start = Date.now();
  let response: NextResponse | null = null;
  const requestLogger = createRequestLogger({ reqId: requestId, route: pathname, method: request.method });

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (process.env.MAINTENANCE_MODE === "true") {
      const maintenanceAllowed =
        pathname.startsWith("/api") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/maintenance") ||
        pathname.startsWith("/favicon");

      if (!maintenanceAllowed) {
        const maintenanceUrl = new URL("/maintenance", request.url);
        maintenanceUrl.searchParams.set("from", pathname);
        response = NextResponse.rewrite(maintenanceUrl);
        return response;
      }
    }

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
      applySecurityHeaders(response, requestId);
      const durationMs = Date.now() - start;
      requestLogger.info({ status: response.status, ms: durationMs }, "Request completed");
    }
  }
}
