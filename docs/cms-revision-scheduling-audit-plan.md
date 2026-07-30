# CMS revisions and scheduled publishing audit

Last verified: **30 July 2026**.

## Scope

This document tracks the implemented CMS/blog revision and scheduling slice: `Post`, `Page`, editor autosave, admin APIs, audit entries, the scheduled publisher, and related tests. Marketplace, workspaces, federation, tenants, and AI extensions remain outside this audit.

## Implemented

### Revision storage

- `PostRevision` and `PageRevision` are defined in `prisma/schema.prisma`.
- Migration `20260711130000_cms_priority2` creates both tables, indexes them by parent/time, and adds parent foreign keys.
- Successful post/page creates and updates call snapshot helpers in `src/lib/cms/revisions.ts`.
- Revision reasons are `autosave`, `manual`, `publish`, or `restore`.
- Post snapshots include title, slug, summary, MDX, cover, status, and publish time. Page snapshots include title, slug, MDX, and published state.

### Restore flow

- `POST /api/admin/posts/[id]/revisions/[revisionId]/restore` restores a post snapshot, creates a new `restore` snapshot, and writes `post:restore_revision` to `AuditLog`.
- `POST /api/admin/pages/[id]/revisions/[revisionId]/restore` restores a page snapshot, creates a new `restore` snapshot, and writes `page:restore_revision` to `AuditLog`.
- The post editor and page manager display recent revisions, provide an in-editor line diff against the current draft, and expose restore controls.
- Restore helpers reject revision IDs that do not belong to the requested parent record.
- Both post and page restores create a resulting `restore` snapshot and write their respective audit entries.

### Scheduled publishing

- `Post.status` supports `DRAFT`, `SCHEDULED`, and `PUBLISHED`; `publishedAt` stores the due time.
- `pnpm posts:publish-scheduled` runs `scripts/utils/publish-scheduled.ts`.
- `publishDueScheduledPosts` selects up to 50 due scheduled posts ordered by due time, publishes them, writes `post:publish` with `source: scheduled-worker`, triggers outbound publish webhooks, and notifies search engines once per non-empty batch.
- Filtering by `SCHEDULED` makes repeated runs idempotent for records already published.
- The editor exposes status and publish-time inputs. RBAC continues to keep writers draft-only.

### Tests

- Unit coverage verifies due-post publication and its audit/webhook behavior.
- Revision helper tests verify snapshot/restore behavior.
- Playwright covers post lifecycle and editor behavior, while visual smoke captures current editor views.

## Known gaps

- No deployment scheduler is declared in `vercel.json`. Vercel Cron was removed for Hobby-plan compatibility, so production must call the authenticated `/api/cron/publish-scheduled` endpoint from an external scheduler or run `pnpm posts:publish-scheduled` in a worker/container.
- Pages use a boolean `published` flag and do not support scheduled publication.
- Revisions have an in-editor line diff, but there is no standalone revision-detail/history endpoint and no diff between two arbitrary stored revisions.
- Restore actions apply immediately from both the revision list and diff view. They do not require an explicit confirmation.
- Scheduled publishing updates the post, then creates an audit entry, then invokes webhooks without a transaction or outbox. Concurrent workers can also select the same due row because the update does not condition on `status: SCHEDULED`, allowing duplicate audit entries and webhook delivery.
- Scheduled publishing has narrow unit coverage and no browser flow for future scheduled post → authenticated worker invocation → public journal visibility.

## Recommended next work

1. Configure an authenticated production scheduler and monitor its exit/result count.
2. Make claiming/publishing concurrency-safe, then use transaction/outbox semantics so publication and webhook delivery are independently recoverable.
3. Add an E2E flow for future scheduled post → due worker run → public visibility, including a second worker invocation.
4. Add explicit restore confirmation and, if needed, a standalone revision history/detail comparison view.
5. Consider scheduled publication for pages only if the product needs parity with posts.

## Release check

Before enabling scheduled publication in an environment:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:full
```

Also execute the scheduler once against a seeded non-production database and confirm that only due `SCHEDULED` posts transition to `PUBLISHED`.
