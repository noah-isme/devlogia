# Devlogia documentation map

This directory separates current operating guidance from historical delivery notes. `README.md`, `package.json`, `.env.example`, Prisma migrations/schema, App Router routes, and executable tests are the implementation sources of truth.

Last synchronized with the codebase: **14 July 2026**.

## Current documentation

| Document                                                                   | Purpose                                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`../README.md`](../README.md)                                             | Product scope, screenshots, setup, routes, commands, and current verification |
| [`DEPLOYMENT.md`](DEPLOYMENT.md)                                           | Staging/production deployment and promotion gates                             |
| [`OPERATIONS.md`](OPERATIONS.md)                                           | Runtime, monitoring, MySQL, storage, and incident operations                  |
| [`BACKUP_RESTORE.md`](BACKUP_RESTORE.md)                                   | Backup/restore commands and recovery checks                                   |
| [`ALERTS.md`](ALERTS.md)                                                   | SLOs, alert conditions, routing, and runbook links                            |
| [`ROTATION.md`](ROTATION.md)                                               | Secret and credential rotation                                                |
| [`AUTH_TROUBLESHOOTING.md`](AUTH_TROUBLESHOOTING.md)                       | Canonical NextAuth 4/JWT troubleshooting                                      |
| [`SDK_GUIDE.md`](SDK_GUIDE.md)                                             | Current beta SDK surface and known route constraints                          |
| [`LANDING_PAGE.md`](LANDING_PAGE.md)                                       | Landing page structure and maintenance notes                                  |
| [`PROMPTS.md`](PROMPTS.md)                                                 | AI prompt templates used by editor tooling                                    |
| [`prisma-migration-audit-cms-blog.md`](prisma-migration-audit-cms-blog.md) | Current migration coverage and beta-model risks                               |

## Plans and beta specifications

These describe code that is partly implemented or intentionally outside the production release scope. Check their status block before treating a checklist as current behavior.

- [`cms-revision-scheduling-audit-plan.md`](cms-revision-scheduling-audit-plan.md) — implementation audit for revisions and scheduled publishing.
- [`phase-12-ecosystem-launch.md`](phase-12-ecosystem-launch.md) — developer ecosystem backlog and current beta surface.
- [`ROLLOUT.md`](ROLLOUT.md) — rollout strategy template; adapt provider-specific commands before use.

## Historical records

The following files record an earlier delivery phase or release. Historical provider names, command shapes, and test counts are not current setup instructions:

- [`phase-2-status.md`](phase-2-status.md)
- [`phase-3-status.md`](phase-3-status.md)
- [`release-notes/v1.0.0-rc.md`](release-notes/v1.0.0-rc.md)
- [`release-notes/v1.0.0.md`](release-notes/v1.0.0.md)
- [`release-notes/v1.0.1.md`](release-notes/v1.0.1.md)
- [`../LANDING_PAGE_SUMMARY.md`](../LANDING_PAGE_SUMMARY.md)
- [`../reports/TENANT_REPORT.md`](../reports/TENANT_REPORT.md)

Use the root README and current runbooks for local or production work.

## Preview assets

`assets/preview/` contains curated Playwright captures from the seeded production build:

- `landing.png`
- `blog.png`
- `blog-mobile.png`
- `admin-dashboard.png`
- `editor.png`

Regenerate the source captures with:

```bash
pnpm db:reset
pnpm exec playwright test tests/e2e/visual-smoke.spec.ts --project=chromium
```

The test writes full-page captures to `test-results/visual-smoke-*`. Curated README assets should be recaptured against `pnpm build` + `pnpm start` so the Next.js development indicator is absent. When the UI changes materially, refresh the preview files and update the audit date in this document and the root README.

## Documentation update checklist

When behavior changes:

1. Update the root README for routes, setup, commands, scope, or screenshots.
2. Update `.env.example` and `.env.production.example` when configuration changes.
3. Regenerate and validate `openapi.yaml` for public API changes.
4. Update the matching runbook when operational behavior changes.
5. Mark plan items delivered instead of leaving implemented work described as missing.
6. Run `pnpm format`, `pnpm devportal:links`, and the relevant quality gates.
