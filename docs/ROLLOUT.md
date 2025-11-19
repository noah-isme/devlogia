# 🔄 Blue-Green Rollout & Rollback Strategy

## Overview

Deployments follow a blue-green pattern:

1. Deploy to **staging** (green) using `pnpm deploy:staging`.
2. Run smoke tests + `/api/ready` checks.
3. Promote staging to **production** (blue) using `pnpm deploy:promote`.
4. Monitor for 24–48 hours.

## Rollout Steps

1. Ensure `MAINTENANCE_MODE=false` in staging.
2. Deploy staging build.
3. Verify `/api/_version` and `/api/health` on staging.
4. Trigger promotion: `vercel promote` or equivalent alias swap.
5. Confirm production readiness: `curl -fsSL https://devlogia.app/api/ready`.
6. Announce release in Slack/Teams.

## Rollback Trigger

Rollback if any of the following occur:

- `/api/ready` returns non-200 for >3 checks.
- Alert thresholds (see `ALERTS.md`) are breached for >10 minutes.
- Critical regression reported by QA or customers.

## Rollback Procedure

1. **Enable Maintenance Mode**: set `MAINTENANCE_MODE=true` and redeploy configuration (or trigger via platform settings). `/maintenance` page confirms downtime.
2. **Swap Traffic Back**: re-alias to the previous production deployment (`vercel alias <previous-deployment>`).
3. **Restore Database**: `pnpm db:restore -- --file <latest-production-backup>`.
4. **Smoke Test**: run `pnpm test:e2e -- --headed=false` or manual checklist.
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
