# 🔐 Security Hardening Guide

## HTTP Security Headers

The proxy (`src/proxy.ts`) applies these headers to responses it handles:

- `Content-Security-Policy`: self-only defaults, HTTPS/data images, HTTPS media, inline styles/scripts, local fonts, restricted frames/base/forms, and an optional `report-uri`. Development/CI also allow eval and WebSocket sources for Next.js tooling.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options`: `DENY`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`

Set `CSP_REPORT_URI` to a collector URL (e.g. Sentry or Report URI) to capture violations.

## Authentication & RBAC

- Admin routes live under `/admin`. The middleware requires an authenticated NextAuth session before routing.
- RBAC logic resides in `src/lib/rbac.ts`. Audit all admin mutations to call `assertCan` with the proper resource context.
- Session cookies must be marked `Secure` and `HttpOnly` (NextAuth does this by default in production).

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
- Local stub storage when Supabase is not fully configured. A configured Supabase upload error is surfaced; it does not silently fall back to local disk.

## Secret Rotation

See [`docs/ROTATION.md`](docs/ROTATION.md) for detailed steps. Key highlights:

| Secret                      | Rotation  | Notes                                                                         |
| --------------------------- | --------- | ----------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Quarterly | Requires Supabase dashboard update + redeploy                                 |
| `LOGTAIL_TOKEN`             | On leak   | Update on Vercel + GitHub Actions                                             |
| `NEXTAUTH_SECRET`           | Annual    | Rotate after invalidating sessions                                            |
| `SENTRY_DSN`                | On leak   | Trigger a controlled test event from the deployed app and verify it in Sentry |

## Credential Hygiene

- Avoid committing `.env` files. CI pulls secrets from GitHub Action secrets.
- Require MFA for all providers (Vercel, Supabase, AWS).
- Grant minimum IAM privileges to CI service accounts.

## Monitoring & Alerts

- `/api/health` includes database, storage, Redis, and rate limit diagnostics.
- `/api/ready` fails when `MAINTENANCE_MODE=true` or when migrations are pending.
- Configure alerting thresholds from [`docs/ALERTS.md`](docs/ALERTS.md) in your observability platform.

## Incident Response

1. Enable maintenance mode (`MAINTENANCE_MODE=true`).
2. Capture logs via Logtail search and Sentry timeline.
3. Evaluate the rollback plan in [`docs/ROLLOUT.md`](docs/ROLLOUT.md) if customer impact persists > 5 minutes.
4. After mitigation, publish RCA and rotate impacted keys.
