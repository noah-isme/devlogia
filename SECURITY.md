# 🔐 Security Hardening Guide

## HTTP Security Headers

The edge middleware (`src/proxy.ts`) enforces the following headers on every response:

- `Content-Security-Policy`: `default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; report-uri <CSP_REPORT_URI>`
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options`: `DENY`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`

Set `CSP_REPORT_URI` to a collector URL (e.g. Sentry or Report URI) to capture violations.

## Authentication & RBAC

* Admin routes live under `/admin`. The middleware requires an authenticated NextAuth session before routing.
* RBAC logic resides in `src/lib/rbac.ts`. Audit all admin mutations to call `assertCan` with the proper resource context.
* Session cookies must be marked `Secure` and `HttpOnly` (NextAuth does this by default in production).

## Supabase Storage Policies

Provision RLS policies for the `devlogia-media` bucket:

```sql
-- Allow public reads
create policy "Public read"
  on storage.objects for select
  using (bucket_id = 'devlogia-media');

-- Allow authenticated writes
create policy "Authenticated write"
  on storage.objects for insert
  with check (
    bucket_id = 'devlogia-media'
    and auth.role() = 'authenticated'
  );

-- Allow authenticated deletes only for service role
create policy "Service delete"
  on storage.objects for delete
  using (
    bucket_id = 'devlogia-media'
    and auth.role() = 'service_role'
  );
```

The upload utility (`src/lib/storage.ts`) enforces:

- SHA-256 checksums for all uploads
- MIME allowlist (`SUPABASE_ALLOWED_MIME_TYPES`) and max size (`SUPABASE_MAX_FILE_SIZE_MB`)
- Server-side fallback to stub storage when Supabase fails

## Secret Rotation

See `ROTATION.md` for detailed steps. Key highlights:

| Secret | Rotation | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Quarterly | Requires Supabase dashboard update + redeploy |
| `LOGTAIL_TOKEN` | On leak | Update on Vercel + GitHub Actions |
| `NEXTAUTH_SECRET` | Annual | Rotate after invalidating sessions |
| `SENTRY_DSN` | On leak | Test event via `pnpm sentry test` |

## Credential Hygiene

- Avoid committing `.env` files. CI pulls secrets from GitHub Action secrets.
- Require MFA for all providers (Vercel, Supabase, AWS).
- Grant minimum IAM privileges to CI service accounts.

## Monitoring & Alerts

- `/api/health` includes database, storage, Redis, and rate limit diagnostics.
- `/api/ready` fails when `MAINTENANCE_MODE=true` or when migrations are pending.
- Configure alerting thresholds from `ALERTS.md` in your observability platform.

## Incident Response

1. Enable maintenance mode (`MAINTENANCE_MODE=true`).
2. Capture logs via Logtail search and Sentry timeline.
3. Evaluate rollback plan in `ROLLOUT.md` if customer impact persists > 5 minutes.
4. After mitigation, publish RCA and rotate impacted keys.
