# Devlogia Operations Runbook

This runbook documents the day-two operations for Devlogia's MySQL + Supabase Storage stack. Keep it alongside your infrastructure repo and update it whenever the deployment topology changes.

## Release Scope

The current operational release scope is the CMS/blog product:

- Public landing page, `/blog`, post detail pages, published static pages, RSS, sitemap, and OG images.
- Admin login, dashboard, post/page CRUD, media uploads, user/RBAC management, and analytics views.
- MySQL-backed CMS tables, Supabase or stub media storage, and Playwright E2E/visual smoke coverage.

Platform modules for AI recommendations, tenants, workspaces, marketplace billing, plugins/extensions, federation, and developer ecosystem workflows remain beta/foundation areas. Keep them disabled in production unless a separate rollout explicitly promotes them.

Operational caveats from the current audit:

- Lint, TypeScript, unit tests, and production build pass as of 14 July 2026. The build still emits non-blocking notices for stale browser baseline data, database-disabled static rendering, unavailable Prisma `$use` middleware, and an edge-runtime page.
- Prisma migrations do not yet cover every model in `schema.prisma`; deploy only the CMS/blog scope with the checked-in migrations until the beta platform tables receive migration coverage.

## 📦 Environment Overview

| Component     | Provider                                            | Notes                                                     |
| ------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Database      | Managed MySQL (e.g. PlanetScale, Aurora, RDS)       | Prisma connects via the `DATABASE_URL` string.            |
| Storage       | Supabase Storage bucket (`SUPABASE_STORAGE_BUCKET`) | Public read, authenticated write with RLS policies below. |
| Runtime       | Next.js 16                                          | Deployed via Vercel/Fly/Container runtime.                |
| Logging       | `pino` structured logs to stdout                    | Ship to Logtail/DataDog via platform log drains.          |
| Observability | Sentry (`SENTRY_DSN`)                               | Optional — init happens in `src/instrumentation.ts`.      |

## 🔐 Secrets Matrix

| Secret                      | Rotation Cadence                                            | Where to Update                                         |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`              | Rotate when credentials change or cluster is reprovisioned. | GitHub Actions, deployment platform, `.env.production`. |
| `SUPABASE_SECRET_KEY`       | Treat as highly privileged (server-only). Rotate quarterly. | CI secrets, serverless runtime env vars.                |
| `NEXTAUTH_SECRET`           | Rotate annually or on incident.                             | CI/deployment env.                                      |
| `SENTRY_DSN`                | On demand.                                                  | Deployment env + CI (optional).                         |

## 🗄️ MySQL Operations

### Backups

1. **Managed snapshots (recommended):**
   - Enable automated daily snapshots with a 7–14 day retention policy on your managed MySQL provider.
   - For PlanetScale, enable [backup scheduling](https://planetscale.com/docs/concepts/backups). For Aurora/RDS, configure automated backups with PITR.
2. **Ad-hoc logical backup:**
   - Run `mysqldump --single-transaction --column-statistics=0 --routines --triggers --databases devlogia > devlogia-$(date +%F).sql`.
   - Store dumps in an encrypted bucket (e.g. AWS S3 with SSE).

### Restores

1. Provision a new MySQL instance (or temporary clone) with the target backup/snapshot.
2. Update `DATABASE_URL` in CI/CD and application secrets to point at the restored endpoint.
3. Run `pnpm prisma migrate deploy` to ensure schema parity, followed by `pnpm prisma db seed` if deterministic data is required.
4. Validate with `pnpm test:e2e` or the shadow comparison tool (`pnpm shadow:compare`).

### Scaling & Maintenance

- Monitor slow queries via your provider's performance insights. Prisma logs queries in development when `LOG_LEVEL=debug`.
- Keep connection pooling enabled (PlanetScale handles this automatically; for Aurora use ProxySQL/RDS Proxy if needed).
- Always run schema changes through Prisma migrations checked into git.

## 🪣 Supabase Storage

### Bucket Provisioning

```sql
-- Run inside the Supabase SQL editor
insert into storage.buckets (id, name, public) values ('devlogia-media', 'devlogia-media', true)
on conflict (id) do update set public = true;
```

### Row-Level Security Policies

```sql
-- Allow anyone to read objects
create policy "Public read"
  on storage.objects for select
  using (bucket_id = 'devlogia-media');

-- Allow authenticated users to insert/delete
create policy "Authenticated write"
  on storage.objects for all
  using (
    bucket_id = 'devlogia-media'
    and auth.role() = 'authenticated'
  )
  with check (bucket_id = 'devlogia-media');
```

Server-side uploads use a secret key and bypass RLS; client-side previews rely on the public bucket flag.

### Key Rotation

1. Generate a new secret key in the Supabase dashboard (`Settings → API Keys`).
2. Update CI secrets (`SUPABASE_SECRET_KEY`) and deployment environment variables.
3. Redeploy the application.
4. Revoke the old key once the rollout is confirmed.

## 🩺 Health & Monitoring

- The `/api/health` endpoint reports overall state plus database, storage, Redis, rate-limit, version, latency, and schema diagnostics. Hook it into uptime monitoring (Pingdom, Better Uptime, etc.).
- The `/api/ready` endpoint returns HTTP 503 when maintenance mode is enabled, the database check fails, or migrations are pending; use it for readiness rather than liveness.
- Logs are structured JSON via `pino`. Configure your platform's log drain to forward to Logtail, DataDog, or CloudWatch.
- Enable Sentry by setting `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, and `SENTRY_PROFILES_SAMPLE_RATE`. Adjust sampling for production traffic.

## 📊 Metrics & Alerting

- `/api/metrics` exposes a secured snapshot (superadmin session or `x-metrics-key`) with request rate, error rate, cache hit ratio, and latency percentiles.
- The proxy middleware records request timings and cache headers, feeding the in-memory registry that powers the endpoint.
- Run `pnpm metrics:sync` in CI/cron to persist `.reports/metrics-latest.json` and dispatch Slack/Telegram alerts when:
  - Error rate exceeds 1% (`METRICS_ERROR_RATE_THRESHOLD`).
  - p95 latency exceeds 800 ms (`METRICS_P95_THRESHOLD_MS`).
- `pnpm metrics:report [endpoint]` prints a human-readable summary for quick triage.
- The scheduled **Performance Monitor** workflow (`.github/workflows/performance-monitor.yml`) executes nightly, publishing metrics artifacts and opening an issue when thresholds are breached.

## 🌐 Performance Monitoring

- `lighthouserc.json` defines Lighthouse thresholds (≥90 for Performance, Accessibility, Best Practices, SEO).
- `pnpm dlx @lhci/cli@0.13.1 autorun --config=lighthouserc.json` runs inside the Performance Monitor workflow; adjust URLs as new critical pages appear.
- Edge/static caching defaults:
  - Static assets (`.js`, `.css`, fonts, images) cache for 1 year with `immutable`.
  - API routes default to `s-maxage=60, stale-while-revalidate=300`.
- Home (`/`) revalidates every 120 s; published posts revalidate every 60 s.

## 🧪 UX Telemetry & Feedback

- Client-side telemetry (scroll depth, session duration, layout variant) is captured by `TelemetryProvider` and POSTed to `/api/telemetry` using `sendBeacon`.
- Telemetry events are logged and stored in `AuditLog` rows (`action = telemetry:*`) when MySQL is available, making them queryable for dashboards.
- The `devlogia-post-layout-variant` experiment splits readers between control and “immersion” variants; `PostShareSection` adjusts CTA placement accordingly.
- A lightweight feedback widget on blog posts sends free-text responses to `/api/telemetry` (`event: "feedback"`). Monitor these via `SELECT * FROM AuditLog WHERE action LIKE 'telemetry:%' ORDER BY createdAt DESC`.

## 🔁 Data Migration Aids

- `pnpm etl` — ETL helper for importing data from the legacy PostgreSQL source into MySQL.
- `pnpm shadow:compare` — Compare JSON hashes between the legacy API and the new stack for parity verification.
- Always run migrations in a staging environment before touching production data.

## 📋 Incident Checklist

1. **Service degradation detected** (alerts or `/api/health` non-`ok`):
   - Inspect recent deploys, DB metrics, and Supabase status.
   - Fail open by toggling `SUPABASE_*` env vars off to fall back to stub storage if necessary.
2. **Database outage:**
   - Promote a replica or restore the latest snapshot. Update `DATABASE_URL`.
   - Run smoke tests (`pnpm test:e2e`, admin CRUD) before reopening traffic.
3. **Storage outage:**
   - Switch to stub mode by clearing `SUPABASE_*` vars. Communicate reduced functionality to content editors.
4. **Credential leak:**
   - Rotate affected secrets immediately. Audit access logs.
5. **Post-incident:**
   - Document RCA, update runbooks, and schedule follow-up tasks.

## ✅ Maintenance Cadence

| Task                                  | Frequency |
| ------------------------------------- | --------- |
| Rotate Supabase service key           | Quarterly |
| Review MySQL slow query log           | Weekly    |
| Verify backups & restore drill        | Quarterly |
| Audit Sentry alert thresholds         | Monthly   |
| Update dependencies (`pnpm outdated`) | Monthly   |

Keep this runbook version-controlled. PRs that alter infrastructure should update this file with the new operational procedures.
