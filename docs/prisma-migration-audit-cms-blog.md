# Prisma Migration Audit: CMS/Blog Release

## Scope

This audit compares `prisma/schema.prisma` with the SQL migrations under `prisma/migrations/**` as of 14 July 2026. It is limited to the CMS/blog release path: public blog browsing, post/page publishing, revisions, scheduled publishing, media uploads, admin auth/RBAC, SEO feeds, and the tests around those flows.

No schema or migration files were changed.

## Migration Coverage Summary

### CMS/blog tables covered by migrations

The CMS/blog release tables are created by `20250101000000_mysql_init`:

- `User`
- `Role`
- `UserRole`
- `Post`
- `Tag`
- `PostTag`
- `Page`
- `Media`
- `AuditLog`
- `PostRevision`
- `PageRevision`

The `Role.name` enum was extended by `20260710000000_extend_role_enum` to include `TENANTADMIN` and `VIEWER`, matching the current `RoleName` enum in `schema.prisma`. Migration `20260711130000_cms_priority2` adds post/page revision tables and their foreign keys.

These tables cover the core release flows: auth users, roles, post/page CRUD, revision restore, tags, media metadata, and CMS audit logging. Scheduled posts reuse `Post.status` and `Post.publishedAt`, so the idempotent scheduled-publishing worker requires no additional table.

### Foundation tables covered by migrations

Several beta/foundation models are also migrated:

- `UserProfile`
- `ContentVector`
- `user_content_affinity` (`UserContentAffinity` in Prisma)
- `HeadlineVariant`
- `AIUsage`
- `AIAuditLog`
- `Embedding`
- `Recommendation`
- `RecommendationSnapshot`
- `TopicCluster`
- `PostTopic`

These support personalization, recommendation, and AI-assist foundations. They are not part of the CMS/blog release commitment, but the post delete path references some of them for cleanup, so keeping these migrations deployed reduces runtime risk around deleting posts.

### Schema models not covered by migrations

The following models exist in `schema.prisma` but no migration currently creates their tables:

- Tenant/platform: `Tenant`, `TenantSettings`, `TenantAnalytics`, `PlanQuota`
- Federation: `FederationIndex`
- Marketplace/plugins: `Plugin`, `PluginInstall`, `Extension`, `ExtensionUsage`
- Billing: `BillingAccount`, `Product`, `Order`, `RevenueSplit`, `Payout`
- AI extensions: `AIExtension`, `AIUsageLog`
- Workspaces/collaboration: `Workspace`, `WorkspaceMember`, `CollaborationSession`, `PresenceState`

Related enums such as `PluginVisibility`, `PluginInstallStatus`, `ExtensionSurface`, `ExtensionRuntime`, `BillingAccountStatus`, `ProductType`, `OrderStatus`, `PayoutStatus`, `AIExtensionCapability`, `AIProvider`, `WorkspaceMemberRole`, and `PresenceStatus` are present in Prisma schema but are not backed by deployed table DDL until their owning models are migrated.

## Deploy Risk

- `prisma migrate deploy` will not create the beta tables listed above, even though Prisma Client exposes those models from `schema.prisma`.
- Any route, page, seed path, or background job that queries those unmigrated beta models will fail at runtime with missing-table errors in an environment built only from the checked-in migrations.
- The CMS/blog path is mostly safe because its core tables are migrated. However, beta UI/API routes for marketplace, billing, federation, AI extensions, and workspaces should not be treated as production-ready until their migrations are complete.
- Post deletion currently cleans up recommendation/personalization tables that are migrated. If deployments omit the phase 9 or AI recommendation migrations, post deletion can fail even though the baseline CMS tables exist.

## Recommendation

Choose one strategy before promoting beta areas:

1. Complete beta migrations: add focused migrations for tenant, workspace, marketplace, billing, federation, and AI extension models, then run targeted API/UI/E2E coverage for each beta module.
2. Split beta schema: move unreleased beta models out of the production Prisma schema or guard their consumers behind a separate deployment profile until their migrations and release gates are ready.

For the CMS/blog release, keep the schema as-is only if beta routes remain out of release scope and the engineering gate documents that missing beta migrations are a known deploy risk.
