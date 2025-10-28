# ♻️ Secret Rotation Procedures

## Supabase Keys

1. Generate new keys via Supabase Dashboard → Settings → API.
2. Update the following secrets in CI/CD and hosting provider:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy staging with `pnpm deploy:staging` and verify uploads.
4. Promote to production via `pnpm deploy:promote`.
5. Revoke the old keys in Supabase once both environments confirm `/api/ready`.

## NextAuth Secret

1. Generate a 32-byte secret: `openssl rand -base64 32`.
2. Update `NEXTAUTH_SECRET` for staging and production.
3. Deploy staging; user sessions will invalidate.
4. Promote to production; inform users about the logout event.

## Logtail Token

1. Issue a new source token in Logtail dashboard.
2. Update `LOGTAIL_TOKEN` in Vercel and GitHub Actions secrets.
3. Redeploy staging and ensure logs flow in the Logtail stream.
4. Promote to production.

## Sentry DSN

1. Create a new client key in Sentry → Project Settings → Client Keys.
2. Update `SENTRY_DSN` in environment settings.
3. Trigger a test event via `pnpm exec sentry-cli send-event`.
4. Deploy staging, then production.
5. Deactivate the old DSN in Sentry.

## Database Credentials

1. Rotate credentials in the managed MySQL provider.
2. Update `DATABASE_URL` everywhere (CI, staging, production).
3. Run `pnpm prisma migrate deploy` on staging.
4. Redeploy and verify `/api/health` latency metrics.
5. Promote to production.

Document every rotation in the change log and update affected runbooks if steps change.
