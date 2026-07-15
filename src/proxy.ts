import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Logger and metrics are not edge-compatible, disabled for now
// import { createRequestLogger } from "@/lib/logger";
// import { recordRequestMetrics } from "@/lib/metrics";

const isDevelopmentLike =
  process.env.NODE_ENV !== "production" || process.env.CI === "true";

const scriptSources = ["'self'", "'unsafe-inline'"];
const connectSources = ["'self'", "https:"];

if (isDevelopmentLike) {
  scriptSources.push("'unsafe-eval'");
  connectSources.push("ws:", "wss:");
}

const cspDirectives = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "media-src 'self' https:",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
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
  let response: NextResponse | null = null;

  try {
    const isAdminPage = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    const isLoginPage = pathname === "/admin/login";
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    const requiresAuth = (isAdminPage && !isLoginPage) || isAdminApi;

    if (requiresAuth && !secret) {
      console.error("[Proxy] No AUTH_SECRET or NEXTAUTH_SECRET configured");
      response = isAdminApi
        ? NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 },
          )
        : NextResponse.redirect(new URL("/admin/login", request.url));
      return response;
    }

    const token =
      secret && (isAdminPage || isAdminApi)
        ? await getToken({ req: request, secret })
        : null;

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

    if (requiresAuth) {
      if (!token) {
        if (isAdminApi) {
          response = NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
          return response;
        }
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set(
          "callbackUrl",
          request.nextUrl.pathname + request.nextUrl.search,
        );
        response = NextResponse.redirect(loginUrl);
        return response;
      }

      if (token.isActive === false) {
        response = isAdminApi
          ? NextResponse.json({ error: "Account disabled" }, { status: 403 })
          : NextResponse.redirect(
              new URL("/admin/login?error=disabled", request.url),
            );
        return response;
      }
    }

    if (isLoginPage && token) {
      response = NextResponse.redirect(
        new URL("/admin/dashboard", request.url),
      );
      return response;
    }

    response = NextResponse.next();
    return response;
  } finally {
    if (response) {
      applySecurityHeaders(response, requestId);
      // Logging and metrics temporarily disabled - not edge-compatible
    }
  }
}
