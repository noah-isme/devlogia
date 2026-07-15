# Deployment Playbook

## Release Scope

The active production release scope is the CMS/blog application:

- Public landing page and `/blog` article index.
- Post detail pages, published static pages, RSS, sitemap, and OG image generation.
- Admin login, dashboard, post/page CRUD, media upload, user/RBAC management, and analytics views.
- Playwright E2E coverage for auth, publishing, media, public blog discovery, and visual smoke screenshots.

Do not treat AI recommendations, marketplace billing, plugins/extensions, tenant workspaces, federation, or developer ecosystem workflows as production release scope yet. Those modules are present as beta/foundation code and need complete migrations, typecheck cleanup, UI flows, and E2E coverage before promotion.

## Environments

| Environment | URL                            | Notes                                                     |
| ----------- | ------------------------------ | --------------------------------------------------------- |
| Local       | `http://localhost:3000`        | Uses dockerised MySQL and stub storage                    |
| Staging     | `https://staging.devlogia.app` | Mirrors production topology with managed MySQL + Supabase |
| Production  | `https://devlogia.app`         | Customer-facing                                           |

Ensure staging and production share the same Prisma schema and Supabase bucket policies. Environment variables are defined in `.env.production.example` and managed via Vercel environment settings.

## Required Environment Variables

See `.env.example` for the complete list. `deploy:staging` currently requires all of these values to be non-empty:

```
DATABASE_URL
NEXT_PUBLIC_APP_URL
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_STORAGE_BUCKET
SENTRY_DSN
LOGTAIL_TOKEN
RATE_LIMIT_REDIS_URL
```

The application itself also requires `NEXTAUTH_URL` and a strong `NEXTAUTH_SECRET` for authentication and preview tokens. The staging script does not currently validate those two keys, so verify them separately before deployment.

Leave beta platform integrations disabled unless they are explicitly being tested in a non-production environment.

## Staging Deployment

```
pnpm deploy:staging -- --staging https://staging.devlogia.app
```

The script validates its required environment, then performs linting, unit tests, build, OpenAPI validation, a database backup, and Playwright smoke tests. It prepares the package but does not deploy or prompt; run the platform-specific deployment command afterwards.

After deployment:

1. Hit `/api/_version` and `/api/health` to confirm the new build and schema version.
2. Run targeted CMS/blog end-to-end tests (`pnpm test:e2e` or `pnpm test:e2e:full` against the staging database).
3. Inspect the Playwright HTML report and all 19 visual smoke captures. Curated examples and the regeneration command are documented in the [root README](../README.md).
4. Ensure Logtail and Sentry receive sample events.

## Production Promotion

```
pnpm deploy:promote -- --staging https://staging.devlogia.app
```

This script checks staging readiness, logs version metadata, takes a production snapshot, and prints alias-promotion guidance. It does not change the production alias itself.

Post-promotion checklist:

1. `curl -fsSL https://devlogia.app/api/ready` should return HTTP 200.
2. Disable `MAINTENANCE_MODE` if it was enabled.
3. Verify primary CMS/blog flows: login, create/edit post, upload media, publish post, browse `/blog`, RSS, sitemap, and OG image.
4. Monitor alerts defined in `ALERTS.md` for 24–48 hours.

## Current Release Blockers

- Prisma migrations do not yet cover every model in `schema.prisma`. The CMS/blog tables are migrated; beta tenant, marketplace, workspace, and ecosystem tables need migration coverage before those features can be released.
- Full E2E remains the final promotion gate for each target environment, because it validates database reset/seed, browser flows, and visual smoke output against that environment.

The local documentation audit on 14 July 2026 passed lint, typecheck, 44 Vitest files / 133 tests, production build, and the visual Playwright smoke scenario. Those results validate the repository state only; rerun the gate against each release candidate and target environment.

## Rollback

Follow `ROLLOUT.md` for blue/green rollback instructions. In brief:

1. Re-point the traffic alias to the previous deployment.
2. Restore the pre-deploy database snapshot via `pnpm db:restore`.
3. Re-run smoke tests.
4. Capture incident notes and update `OPERATIONS.md`.

Keep this playbook updated whenever deployment tooling or infrastructure changes.
