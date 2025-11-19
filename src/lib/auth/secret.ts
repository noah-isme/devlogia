/**
 * Single Source of Truth for NextAuth Secret
 * 
 * This module ensures ALL parts of the application (NextAuth config, 
 * middleware, getToken calls, API routes) use the EXACT SAME secret
 * for JWT encryption/decryption.
 * 
 * Import this in:
 * - src/lib/auth.ts (authOptions)
 * - src/proxy.ts (getToken)
 * - middleware.ts (if re-enabled)
 * - Any route using getToken()
 * 
 * IMPORTANT: Use getAuthSecret() function instead of AUTH_SECRET constant
 * to ensure compatibility with edge runtime.
 */

/**
 * Get AUTH_SECRET at runtime (lazy evaluation)
 * This avoids issues with edge runtime and module-level evaluation
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  
  if (!secret) {
    throw new Error(
      "AUTH_SECRET or NEXTAUTH_SECRET must be defined in environment variables. " +
      "Generate one with: openssl rand -base64 48"
    );
  }
  
  return secret;
}

// Legacy export for backward compatibility (lazy evaluation)
export const AUTH_SECRET = getAuthSecret();

/**
 * Validates that the secret meets minimum security requirements
 */
export function validateSecret(): void {
  if (AUTH_SECRET && AUTH_SECRET.length < 32) {
    console.warn(
      "⚠️  AUTH_SECRET is too short. Use at least 32 characters for production. " +
      "Generate a secure secret with: openssl rand -base64 48"
    );
  }
}

// Note: Validation is available but not run on import to avoid edge runtime issues
// Call validateSecret() manually in Node.js runtime if needed
