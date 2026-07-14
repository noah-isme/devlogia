# Quick fix: NextAuth JWT decryption

This short note is retained for existing links. The maintained guide is [`AUTH_TROUBLESHOOTING.md`](AUTH_TROUBLESHOOTING.md).

1. Set the same strong `NEXTAUTH_SECRET` on every application instance.
2. Remove `AUTH_SECRET` or set it to the identical value.
3. Restart the app, clear NextAuth session cookies, and sign in again.
4. Verify `GET /api/auth/self-test` and refresh `/admin/dashboard`.

Devlogia uses NextAuth 4. `NEXTAUTH_SECRET` is canonical and is required by CMS preview-token code. Rotating it invalidates existing sessions and previews.
