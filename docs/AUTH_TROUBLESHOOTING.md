# NextAuth JWT troubleshooting

Devlogia currently uses **NextAuth 4.24** with credential login and JWT sessions. `NEXTAUTH_SECRET` is the canonical environment key in `.env.example`, `.env.test`, `.env.ci`, and `.env.production.example`.

Middleware and the NextAuth configuration also accept `AUTH_SECRET` as a compatibility override:

```ts
process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
```

CMS preview tokens read `NEXTAUTH_SECRET` directly, so deployments should always set a strong `NEXTAUTH_SECRET` even when `AUTH_SECRET` is also present.

## JWE decryption failures

Common symptoms include `JWEDecryptionFailed`, a login that immediately returns to `/admin/login`, or sessions disappearing between requests.

Likely causes:

- The application instances use different secrets.
- `NEXTAUTH_SECRET` changed while an old browser cookie remained.
- Middleware and the server were started with different environment files.
- `NEXTAUTH_URL` does not match the hostname/scheme used by the browser.

## Recovery

1. Set one strong secret in the active environment:

   ```bash
   openssl rand -base64 48
   ```

   ```env
   NEXTAUTH_SECRET="replace-with-the-generated-value"
   NEXTAUTH_URL="http://localhost:3001"
   ```

2. If `AUTH_SECRET` is set by the hosting platform, either remove it or make it identical to `NEXTAUTH_SECRET`.
3. Restart every application instance so all processes load the same value.
4. Delete the `next-auth.session-token` cookie (and its secure-prefixed production equivalent), then sign in again.
5. Test `GET /api/auth/self-test`. It should return `ok: true` without exposing the secret.

## Verification checklist

- `src/lib/auth.ts`, `middleware.ts`, and `src/proxy.ts` resolve the same secret.
- `src/lib/cms/preview-token.ts` can read `NEXTAUTH_SECRET`.
- `NEXTAUTH_URL` matches the external application URL.
- Login redirects to `/admin/dashboard` and a refresh preserves the session.
- `/admin` routes reject anonymous users and retain role restrictions after login.

## Production rotation

Changing `NEXTAUTH_SECRET` invalidates active JWT sessions and CMS preview tokens. Plan the rotation, update all instances atomically, redeploy, and communicate that users must sign in again. See [`ROTATION.md`](ROTATION.md) for the operational sequence.

Never log, paste, or commit a real secret. The values in checked-in environment templates are placeholders for local/test use only.
