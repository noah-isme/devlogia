# Quick Fix: NextAuth JWT Decryption Error

## 🚨 Error
```
JWT_SESSION_ERROR JWEDecryptionFailed: decryption operation failed
```

## ✅ Solution (Already Implemented)

This project uses **centralized AUTH_SECRET** pattern to prevent JWT mismatch errors.

### Architecture

```
src/lib/auth/secret.ts  (Single Source of Truth)
          ↓
    ┌─────┴─────┬──────────┬──────────┐
    ↓           ↓          ↓          ↓
auth.ts    proxy.ts   middleware  getToken calls
```

All JWT operations use the **same secret** from one file.

---

## For New Developers

### 1. Check `.env` Configuration

```bash
# Both must be identical
AUTH_SECRET="gmNVWP88UHPAwQOIdKN2WJeL6tXQWnQet2AcZVK6GJFrJRoOufcGmKSwaaVjR9dd"
NEXTAUTH_SECRET="gmNVWP88UHPAwQOIdKN2WJeL6tXQWnQet2AcZVK6GJFrJRoOufcGmKSwaaVjR9dd"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
```

### 2. Clear Everything and Restart

```bash
# Stop server
pkill -f "pnpm dev"

# Clear cache
rm -rf .next

# Clear browser cookies (DevTools → Application → Cookies)
# Delete: next-auth.session-token

# Restart
pnpm dev
```

### 3. Test JWT Operations

```bash
curl http://localhost:3000/api/auth/self-test
# Should return: {"ok":true, ...}
```

---

## For Production Deployment

### 1. Generate New Secret

```bash
openssl rand -base64 48
```

### 2. Set in Environment

```bash
# Vercel/Railway/etc
AUTH_SECRET="your-generated-secret"
NEXTAUTH_SECRET="your-generated-secret"  # same value!
AUTH_URL="https://yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"
```

### 3. Enable Trust Host

Already configured in `src/lib/auth.ts`:
```typescript
export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  trustHost: true, // ✅ For production behind proxy
  // ...
};
```

---

## Adding New Auth Code

**❌ DON'T DO THIS:**
```typescript
// BAD: Different secrets
const token = await getToken({ 
  req, 
  secret: process.env.NEXTAUTH_SECRET 
});
```

**✅ DO THIS:**
```typescript
// GOOD: Centralized secret
import { AUTH_SECRET } from "@/lib/auth/secret";

const token = await getToken({ 
  req, 
  secret: AUTH_SECRET 
});
```

---

## Troubleshooting

### Issue: "AUTH_SECRET missing" error on startup

**Fix**: Add to `.env`:
```bash
AUTH_SECRET="your-secret-here"
```

### Issue: Self-test returns `{"ok": false}`

**Fix**:
1. Check `.env` has `AUTH_SECRET` set
2. Restart server: `rm -rf .next && pnpm dev`
3. Verify both secrets are identical

### Issue: Login works but session lost on refresh

**Fix**:
1. Clear browser cookies
2. Check `AUTH_URL` matches the URL you're accessing
3. Don't mix `localhost` and `127.0.0.1`

### Issue: Works locally but fails in production

**Fix**:
1. Verify production env vars are set
2. Check `trustHost: true` is enabled
3. Ensure `AUTH_URL` matches production domain
4. Use HTTPS in production (`https://`)

---

## Files Modified

- ✅ `src/lib/auth/secret.ts` - Centralized secret
- ✅ `src/lib/auth.ts` - Uses centralized secret
- ✅ `src/proxy.ts` - Uses centralized secret  
- ✅ `src/app/api/auth/self-test/route.ts` - Test endpoint
- ✅ `.env` - Consistent secrets (48 bytes)

---

## References

- 📄 Full guide: `docs/AUTH_TROUBLESHOOTING.md`
- 🔐 Secret module: `src/lib/auth/secret.ts`
- 🧪 Test endpoint: http://localhost:3000/api/auth/self-test
