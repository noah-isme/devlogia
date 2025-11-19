# NextAuth JWT Troubleshooting

## ✅ FIXED: Centralized AUTH_SECRET Implementation

**Status**: Issue resolved with single source of truth pattern.

All JWT operations now use `src/lib/auth/secret.ts` which ensures:
- ✅ Consistent secret across all processes (NextAuth, getToken, middleware)
- ✅ Proper fallback mechanism (AUTH_SECRET → NEXTAUTH_SECRET)
- ✅ Runtime validation with helpful error messages
- ✅ Self-test endpoint at `/api/auth/self-test` for verification

---

## Common Issue: JWE Decryption Failed

### Symptoms
- Error: `JWEDecryptionFailed: decryption operation failed`
- Users can't login or get logged out randomly
- Session errors in console

### Root Causes

#### 1. **Inconsistent SECRET between processes**
- Token encrypted with secret A, server using secret B
- NextAuth v5 uses `AUTH_SECRET`, v4 uses `NEXTAUTH_SECRET`
- Multiple processes reading different env vars

#### 2. **Old cookies with different encryption**
- Secret was changed but old session cookies still exist
- Browser still sending tokens encrypted with old secret

#### 3. **Missing secret in specific routes**
- API routes use one secret, middleware uses another (or default)
- Edge runtime vs Node.js runtime using different configs

---

## Solution (✅ IMPLEMENTED)

### 1. Single Source of Truth Pattern

**File: `src/lib/auth/secret.ts`** (centralized secret management)

```typescript
export const AUTH_SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (() => {
    throw new Error("AUTH_SECRET/NEXTAUTH_SECRET missing");
  })();
```

This ensures ALL parts of the app use the **exact same secret**:
- NextAuth configuration (`authOptions`)
- Token validation (`getToken`)
- Middleware (if re-enabled)
- Any custom auth logic

### 2. Set Consistent Secrets in `.env`

```bash
# NextAuth v5 (primary)
AUTH_SECRET="gmNVWP88UHPAwQOIdKN2WJeL6tXQWnQet2AcZVK6GJFrJRoOufcGmKSwaaVjR9dd"
AUTH_URL="http://localhost:3000"

# NextAuth v4 (backward compatibility)
NEXTAUTH_SECRET="gmNVWP88UHPAwQOIdKN2WJeL6tXQWnQet2AcZVK6GJFrJRoOufcGmKSwaaVjR9dd"
NEXTAUTH_URL="http://localhost:3000"
```

**Important**: 
- Both secrets must have **exactly the same value**
- Use 48+ characters for production (generated with `openssl rand -base64 48`)

### 3. Update Auth Configuration

**File: `src/lib/auth.ts`**

```typescript
import { AUTH_SECRET } from "@/lib/auth/secret"; // ✅ Import centralized secret

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET, // ✅ Single source of truth
  session: { strategy: "jwt" },
  // ... rest of config
};
```

### 4. Update Token Validation

**File: `src/proxy.ts`**

```typescript
import { AUTH_SECRET } from "@/lib/auth/secret"; // ✅ Import same secret

export default async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: AUTH_SECRET });
  // ...
}
```

### 5. Clear Browser Cookies & Next.js Cache

After implementing the fix:

1. **Clear Next.js build cache**:
   ```bash
   rm -rf .next
   pnpm dev
   ```

2. **Clear browser cookies**:
   - Open DevTools → Application/Storage → Cookies
   - Delete `next-auth.session-token` and `__Secure-next-auth.session-token`
   - Or use **Incognito/Private mode** for testing

---

## Verification Checklist

- [x] `src/lib/auth/secret.ts` created as single source of truth
- [x] `AUTH_SECRET` and `NEXTAUTH_SECRET` have identical values in `.env`
- [x] `authOptions` in `src/lib/auth.ts` imports and uses `AUTH_SECRET`
- [x] All `getToken()` calls import and use `AUTH_SECRET`
- [x] `.next` cache cleared after changes
- [x] Server restarted with clean build
- [x] Self-test endpoint created at `/api/auth/self-test`

### Test Verification

Run the self-test endpoint to confirm everything works:

```bash
curl http://localhost:3000/api/auth/self-test
```

Expected response:
```json
{
  "ok": true,
  "payload": { "ping": "pong", ... },
  "secretLength": 64,
  "message": "JWT encode/decode working correctly with AUTH_SECRET"
}
```

If `"ok": false`, check:
1. `.env` file has both `AUTH_SECRET` and `NEXTAUTH_SECRET` set
2. Both values are identical
3. Server was restarted after changes

---

## Generate New Secret (if needed)

```bash
# Generate secure 32-byte secret
openssl rand -base64 32
```

Or:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Production Considerations

1. **Never commit secrets** to Git
2. **Use different secrets** for dev/staging/production
3. **Rotate secrets** periodically (requires user re-login)
4. **Set `trustHost: true`** if behind proxy/load balancer

```typescript
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  trustHost: true, // ✅ For production behind proxy
  // ...
};
```

---

## Related Files

- `src/lib/auth.ts` - Main auth configuration
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API handler
- `src/proxy.ts` - Token validation in middleware
- `.env` - Environment variables

---

## References

- [NextAuth.js v5 Migration](https://authjs.dev/getting-started/migrating-to-v5)
- [JWT Strategy](https://next-auth.js.org/configuration/options#jwt)
- [JWE Encryption](https://jose.dev/jwe/compact/decrypt)
