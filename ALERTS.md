# 🚨 Alert Catalogue

Monitor the following service level objectives (SLOs) and trigger alerts when breached.

## SLO Targets

| Metric | Target | Window |
| --- | --- | --- |
| Availability | ≥ 99.9% | Monthly |
| API p95 latency | < 400 ms | Rolling 5 min |
| Error rate | < 0.5% | Rolling 5 min |

## Alert Policies

| Alert | Condition | Action |
| --- | --- | --- |
| Availability drop | `uptime < 99%` over 10 minutes | Page on-call, enable maintenance if active incident |
| p95 latency spike | `p95 > 800ms` for 10 minutes | Investigate slow queries, enable canary rollback |
| 5xx burst | `error_rate > 1%` for 5 minutes | Rollback to previous deploy if persistent |
| Ready failures | `/api/ready` fails 3 consecutive checks | Hold traffic, review migrations |
| Redis saturation | Rate limiter returns `blocked` > 5% requests | Increase plan or adjust limits |

## Dashboard Queries

* **Top routes latency**: group Logtail metrics by `route` and `ms` fields.
* **Error funnel**: Sentry issue table filtered by release (`gitSha` tag).
* **Rate limiting**: Graph the count of `429` responses from API logs.

## Alert Routing

| Severity | Channel |
| --- | --- |
| SEV-1 | PagerDuty + SMS |
| SEV-2 | PagerDuty + Slack `#devlogia-ops` |
| SEV-3 | Slack `#devlogia-ops` |

## Runbook Links

- `OPERATIONS.md` for day-to-day ops
- `BACKUP_RESTORE.md` for recovery
- `ROLLOUT.md` for rollout/rollback
- `SECURITY.md` for security incidents

Review alert thresholds quarterly to ensure they align with real-world traffic patterns.
