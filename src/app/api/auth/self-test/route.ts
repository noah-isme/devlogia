/**
 * Self-test route to verify NextAuth JWT encryption/decryption works correctly
 * 
 * This endpoint tests that:
 * 1. AUTH_SECRET is properly loaded
 * 2. JWT signing works (encode)
 * 3. JWT verification works (decode)
 * 4. The same secret is used for both operations
 * 
 * Usage: GET /api/auth/self-test
 * 
 * Success response:
 * {
 *   "ok": true,
 *   "payload": { "ping": "pong", ... },
 *   "secretLength": 64,
 *   "message": "JWT encode/decode working correctly"
 * }
 * 
 * Error response:
 * {
 *   "ok": false,
 *   "error": "Error message",
 *   "secretLength": 64
 * }
 */

import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

export const runtime = "nodejs"; // Force Node.js runtime for crypto operations

export async function GET() {
  try {
    // Get secret with fallback
    const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    
    if (!AUTH_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTH_SECRET or NEXTAUTH_SECRET not configured",
          secretLength: 0,
        },
        { status: 500 }
      );
    }
    
    // Convert secret to Uint8Array for jose library
    const key = new TextEncoder().encode(AUTH_SECRET);

    // Test 1: Create a JWT token (sign)
    const jwt = await new SignJWT({ ping: "pong", test: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("devlogia-self-test")
      .sign(key);

    // Test 2: Verify the JWT token (decode)
    const { payload } = await jwtVerify(jwt, key, {
      issuer: "devlogia-self-test",
    });

    // Success - same secret worked for both encode and decode
    return NextResponse.json(
      {
        ok: true,
        payload,
        secretLength: AUTH_SECRET.length,
        message: "JWT encode/decode working correctly with AUTH_SECRET",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Failure - secret mismatch or crypto error
    const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        secretLength: authSecret?.length ?? 0,
        message: "JWT operation failed - check AUTH_SECRET configuration",
      },
      { status: 500 }
    );
  }
}
