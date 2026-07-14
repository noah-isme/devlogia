# CMS revisions and scheduled publishing audit

Last verified: **14 July 2026**.

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
- `POST /api/admin/pages/[id]/revisions/[revisionId]/restore` restores a page snapshot and writes `page:restore_revision`.
- The post editor and page manager display recent revisions and expose restore controls.
- Restore helpers reject revision IDs that do not belong to the requested parent record.

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

- No deployment scheduler is declared in `vercel.json`; production must invoke `pnpm posts:publish-scheduled` from an external cron/container scheduler.
- Pages use a boolean `published` flag and do not support scheduled publication.
- Revision lists are loaded with their parent edit pages; there is no dedicated revision-detail/diff endpoint.
- The page restore helper does not create an additional `restore` snapshot after applying the selected revision, unlike the post restore flow.
- Scheduled publishing updates posts one at a time and does not wrap the content update, audit entry, and webhook in one transaction/outbox.
- The scheduled-publishing behavior has unit coverage but no dedicated browser test that advances a due post through the command into the public journal.

## Recommended next work

1. Configure an authenticated production scheduler and monitor its exit/result count.
2. Add an E2E flow for future scheduled post → due worker run → public visibility.
3. Add revision detail/diff UI and explicit restore confirmation.
4. Make page restore semantics consistent with post restore by recording the resulting snapshot.
5. Consider transaction/outbox semantics so database publication and webhook delivery are recoverable independently.

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
