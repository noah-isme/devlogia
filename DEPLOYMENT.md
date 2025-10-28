# 🚀 Deployment Playbook

## Environments

| Environment | URL | Notes |
| --- | --- | --- |
| Local | `http://localhost:3000` | Uses dockerised MySQL and stub storage |
| Staging | `https://staging.devlogia.app` | Mirrors production topology with managed MySQL + Supabase |
| Production | `https://devlogia.app` | Customer-facing |

Ensure staging and production share the same Prisma schema and Supabase bucket policies. Environment variables are defined in `.env.production.example` and managed via Vercel environment settings.

## Required Environment Variables

See `.env.example` for the complete list. The deployment scripts require the following at minimum:

```
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
NEXT_PUBLIC_APP_URL
SENTRY_DSN
LOGTAIL_TOKEN
RATE_LIMIT_REDIS_URL
```

## Staging Deployment

```
pnpm deploy:staging -- --staging https://staging.devlogia.app
```

The script performs linting, unit tests, build, OpenAPI validation, database backup, and smoke tests before prompting for the platform-specific deploy command (Vercel/Fly/etc.).

After deployment:

1. Hit `/api/_version` and `/api/health` to confirm the new build and schema version.
2. Run targeted end-to-end tests (`pnpm test:e2e`).
3. Ensure Logtail and Sentry receive sample events.

## Production Promotion

```
pnpm deploy:promote -- --staging https://staging.devlogia.app
```

This script checks staging readiness, captures the version metadata, takes a production snapshot, and guides you through the alias promotion.

Post-promotion checklist:

1. `curl -fsSL https://devlogia.app/api/ready` should return HTTP 200.
2. Disable `MAINTENANCE_MODE` if it was enabled.
3. Verify primary flows (login, publish post, RSS, sitemap).
4. Monitor alerts defined in `ALERTS.md` for 24–48 hours.

## Rollback

Follow `ROLLOUT.md` for blue/green rollback instructions. In brief:

1. Re-point the traffic alias to the previous deployment.
2. Restore the pre-deploy database snapshot via `pnpm db:restore`.
3. Re-run smoke tests.
4. Capture incident notes and update `OPERATIONS.md`.

Keep this playbook updated whenever deployment tooling or infrastructure changes.
