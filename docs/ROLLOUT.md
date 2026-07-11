# Blue-Green Rollout & Rollback Strategy

## Overview

This rollout plan applies to the current CMS/blog release scope. Beta platform features such as marketplace billing, plugin/extension publishing, tenant workspaces, federation, and developer ecosystem workflows should remain disabled or treated as non-release functionality until their migrations, type checks, UI flows, and E2E tests are complete.

Deployments follow a blue-green pattern:

1. Deploy to **staging** (green) using `pnpm deploy:staging`.
2. Run smoke tests + `/api/ready` checks.
3. Promote staging to **production** (blue) using `pnpm deploy:promote`.
4. Monitor for 24–48 hours.

## Rollout Steps

1. Ensure `MAINTENANCE_MODE=false` in staging.
2. Deploy staging build.
3. Verify `/api/_version` and `/api/health` on staging.
4. Run CMS/blog smoke coverage:
   - Login at `/admin/login`.
   - Create or edit a post in `/admin/posts`.
   - Upload media in the editor.
   - Publish the post and confirm it appears on `/blog`.
   - Check `/api/rss`, `/api/sitemap`, and a generated OG image.
   - Inspect Playwright visual smoke screenshots when using `pnpm test:e2e:full`.
5. Trigger promotion: `vercel promote` or equivalent alias swap.
6. Confirm production readiness: `curl -fsSL https://devlogia.app/api/ready`.
7. Announce release in Slack/Teams.

## Rollback Trigger

Rollback if any of the following occur:

- `/api/ready` returns non-200 for >3 checks.
- Alert thresholds (see `ALERTS.md`) are breached for >10 minutes.
- Critical CMS/blog regression reported by QA or customers, especially login, publish, media upload, public blog rendering, RSS, sitemap, or OG generation.

## Rollback Procedure

1. **Enable Maintenance Mode**: set `MAINTENANCE_MODE=true` and redeploy configuration (or trigger via platform settings). `/maintenance` page confirms downtime.
2. **Swap Traffic Back**: re-alias to the previous production deployment (`vercel alias <previous-deployment>`).
3. **Restore Database**: `pnpm db:restore -- --file <latest-production-backup>`.
4. **Smoke Test**: run `pnpm test:e2e -- --headed=false` or the CMS/blog manual checklist above.
5. **Disable Maintenance**: set `MAINTENANCE_MODE=false` once healthy.
6. **Post-Mortem**: capture cause, remediation, and update runbooks.

## Canary Option

For high-risk releases enable `CANARY_PERCENT` on the platform load balancer:

1. Route 10% of traffic to staging deployment alias.
2. Monitor key metrics (error rate, latency) for 30 minutes.
3. If stable, complete the alias swap.
4. If unstable, reduce to 0% and follow rollback steps above.

## Change Log

Update `docs/release-notes/` with the version, Git SHA, schema version, and notable changes for every rollout.
