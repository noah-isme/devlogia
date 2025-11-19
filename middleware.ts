// Middleware disabled to fix edge runtime issues
// Edge runtime has compatibility issues with:
// - pino logger (uses Node.js streams)
// - ioredis (uses Node.js net)  
// - JWT operations with undefined secrets
//
// Auth protection implemented at page/layout level instead

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // Passthrough - no middleware logic
  return NextResponse.next();
}

export const config = {
  matcher: [],  // Disable all middleware matching
};
