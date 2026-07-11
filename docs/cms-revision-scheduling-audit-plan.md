# CMS Revision, Scheduling, and Audit Trail Plan

## Scope

This plan covers CMS/blog only: `Post`, `Page`, editor autosave, admin post/page APIs, public `/blog`, and Playwright coverage. It intentionally excludes marketplace, workspaces, federation, tenant platform, and AI extension features.

## Current Baseline

- `Post` already has `status` with `DRAFT`, `PUBLISHED`, and `SCHEDULED`, plus `publishedAt`.
- `Page` has a boolean `published` flag but no scheduled publish timestamp.
- `AuditLog` records CMS actions through `recordAuditLog`, including post/page create, update, publish, unpublish, and delete events.
- The editor persists drafts through `/api/admin/posts` and `/api/admin/posts/[id]`, with localStorage recovery when autosave cannot reach the server.
- There is no first-class revision table, no scheduler worker, and no normalized audit target type.

## Schema Changes

Add revision history tables:

```prisma
model PostRevision {
  id          String   @id @default(cuid()) @db.VarChar(191)
  postId      String   @db.VarChar(191)
  version     Int
  title       String   @db.VarChar(191)
  slug        String   @db.VarChar(191)
  summary     String?  @db.VarChar(512)
  contentMdx  String   @db.LongText
  coverUrl    String?  @db.VarChar(512)
  status      PostStatus
  tags        Json     @default("[]")
  publishedAt DateTime?
  authorId    String?  @db.VarChar(191)
  createdById String?  @db.VarChar(191)
  createdAt   DateTime @default(now())

  @@unique([postId, version])
  @@index([postId, createdAt])
}

model PageRevision {
  id          String   @id @default(cuid()) @db.VarChar(191)
  pageId      String   @db.VarChar(191)
  version     Int
  title       String   @db.VarChar(191)
  slug        String   @db.VarChar(191)
  contentMdx  String   @db.LongText
  published   Boolean
  createdById String?  @db.VarChar(191)
  createdAt   DateTime @default(now())

  @@unique([pageId, version])
  @@index([pageId, createdAt])
}
```

Extend scheduling fields:

- Keep `Post.status = SCHEDULED` and `Post.publishedAt` as the scheduled time when status is scheduled.
- Add `Page.publishedAt DateTime?` and `Page.status` only if pages need parity with posts. If page scheduling is not needed in v1, keep pages boolean-only and exclude them from the scheduler.

Improve audit metadata without replacing the current table:

- Add optional `targetType String? @db.VarChar(64)` to `AuditLog` for `post`, `page`, or `media`.
- Keep `action` as the event name for compatibility: `post:create`, `post:update`, `post:publish`, `post:scheduled`, `post:delete`, `page:update`, and similar.

## API Changes

Revision history:

- On successful `POST /api/admin/posts`, create revision `version=1` in the same transaction as the post.
- On successful `PATCH /api/admin/posts/[id]`, create the next `PostRevision` only when editable fields changed.
- Add `GET /api/admin/posts/[id]/revisions` to return revision metadata and optional selected snapshot.
- Add `POST /api/admin/posts/[id]/revisions/[revisionId]/restore` to copy a revision back into the editable post fields, then create a new revision for the restore action.
- Mirror the same pattern for pages if page revision history is in the release slice.

Scheduled publishing:

- Treat `status=SCHEDULED` with future `publishedAt` as a queued publish.
- Reject `SCHEDULED` without `publishedAt` and reject past scheduled timestamps at the validation boundary.
- Keep writers unable to publish or schedule by preserving the existing writer downgrade to `DRAFT`.
- Emit `post:scheduled` when a post enters the scheduled state.

Audit trail:

- Wrap content mutations in transactions that write the content change, revision row, and audit log together where possible.
- Include concise metadata: previous status, next status, slug, version, and scheduled timestamp. Do not store full content in `AuditLog.meta`; full snapshots belong in revision tables.

## Worker Design

Implement a small idempotent scheduler command first, then decide deployment mechanism:

- Command: `pnpm cms:publish-scheduled` calls a server-side function that finds `Post` rows where `status=SCHEDULED` and `publishedAt <= now`.
- Transaction per post: update status to `PUBLISHED`, keep `publishedAt`, create an audit log `post:publish`, trigger outbound publish webhook, and notify search engines.
- Idempotency: filter by `SCHEDULED` so repeated runs do not republish the same post.
- Deployment options: Vercel Cron hitting an authenticated route, container cron running the pnpm command, or CI scheduled workflow for lower environments.

## UI Changes

Post editor:

- Add explicit schedule controls next to status and published date.
- Show validation when scheduled timestamp is missing or in the past.
- Show a revision panel with version, actor, timestamp, status, and restore action.
- Preserve the existing autosave and local draft recovery UX.

Pages:

- Add revision panel if page revisions are included.
- Add scheduling controls only if page scheduling is explicitly added to schema.

Admin listings:

- Keep the existing `Scheduled` post filter.
- Display scheduled publish time for scheduled posts.
- Add audit/revision links from post/page edit pages rather than changing public layout.

## E2E Coverage

Add or extend Playwright specs for:

- Creating a draft, editing it twice, and seeing two or more revision entries.
- Restoring an older post revision and verifying the editor content changes.
- Scheduling a post for a future timestamp and verifying it remains hidden on `/blog`.
- Running the scheduler against a due scheduled post and verifying it appears on `/blog`.
- Verifying writer users cannot publish, schedule, restore another user's post, or delete another user's content.
- Verifying audit entries are created for create, update, scheduled, publish, restore, and delete actions through an admin-visible audit endpoint or a test-only database assertion.

## Rollout Steps

1. Add Prisma migration for revisions and any audit metadata fields.
2. Add revision writer helpers and unit tests around version increments.
3. Transactionalize post/page mutation routes so content, revision, and audit writes stay consistent.
4. Add scheduler service and command with unit tests for idempotent due-post selection.
5. Add editor revision/scheduling UI with Playwright coverage.
6. Run `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e:full` before enabling scheduled publishing in production.
