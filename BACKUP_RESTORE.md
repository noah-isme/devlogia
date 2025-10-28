# 📦 Backup & Restore Runbook

This guide outlines the backup cadence and disaster recovery procedures for Devlogia's MySQL + Supabase deployment.

## Automated Backups

| Component | Strategy | Retention |
| --- | --- | --- |
| MySQL | Managed snapshots (PlanetScale/Aurora/RDS) with point-in-time recovery | 14 days minimum |
| Supabase Storage | Daily bucket export using Supabase backup jobs | 7 days |
| Configuration | Git history + Vercel environment history | Infinite |

## Pre-deploy Snapshots

The CI/CD pipeline and local `deploy:*` scripts take logical backups before applying migrations. The snapshot artifacts are stored in `backups/<environment>` with a 14 day retention policy enforced by object lifecycle rules.

```
pnpm db:backup -- --out backups/staging
```

## Manual Backup Checklist

1. Ensure `DATABASE_URL` points at the target environment.
2. Run `pnpm db:backup -- --out backups/manual`.
3. Verify the `.sql.gz` artifact exists and upload it to the encrypted backup bucket.
4. Document the backup in the release notes or change ticket.

## Restore Procedure

1. **Quiesce traffic**: enable `MAINTENANCE_MODE=true` and confirm `/api/ready` returns `503`.
2. **Restore database**:
   ```
   pnpm db:restore -- --file backups/production/devlogia-backup-2025-03-01-1200.sql.gz
   ```
3. **Reapply migrations**: `pnpm prisma migrate deploy`.
4. **Run smoke tests**: `pnpm test:e2e`.
5. **Re-enable traffic**: set `MAINTENANCE_MODE=false`, confirm `/api/ready` returns `200`.
6. File a post-incident report and attach the restored backup checksum.

## Supabase Storage Recovery

* Download the latest Supabase bucket export.
* Recreate the bucket ACL using the policies in `SECURITY.md`.
* Use `supabase storage cp` to upload content.
* Clear stale CDN caches if applicable.

## Verification

* `/api/health` should report `status: ok` with current schema version.
* Application telemetry (Sentry, Logtail) should resume within 5 minutes.

Keep this document updated whenever backup tooling changes.
