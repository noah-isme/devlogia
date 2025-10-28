# Phase 3 status

## RBAC & audit logging
- Superadmins, admins, editors, and writers seeded via Prisma with role-aware defaults.
- API routes enforce permissions with reusable RBAC helpers and record activity in the `AuditLog` table.
- Admin UI gains a **Users** screen so superadmins can review and update member roles.
- Writer dashboard hides publish controls and restricts status updates to drafts only.

## AI assist
- Provider-agnostic AI interface with OpenAI, Hugging Face, or null fallback options.
- New `/api/ai/*` endpoints validate payloads, enforce RBAC (`ai:use`), and apply per-user rate limits.
- Editor sidebar includes an "AI Assist" panel (outline, meta, tags, rephrase) with apply/clear actions and disabled state when unavailable.

## Webhooks & revalidation
- Publishing/unpublishing posts triggers outbound webhook POSTs with event metadata.
- Inbound `/api/webhooks/revalidate` endpoint validates HMAC signatures, rate limits callers, and revalidates affected paths.
- All publish/unpublish actions are captured in audit logs for traceability.

## Testing & tooling
- Vitest coverage for RBAC decisions, AI provider fallbacks, and webhook utilities.
- Playwright specs for writer restrictions, AI assist panel state, and publish audit logging.
- Rate limiting helpers expose reset hooks to keep tests deterministic.
- CI Playwright pipeline now runs inside `mcr.microsoft.com/playwright:v1.47.0-jammy` with cached browsers, seeded Postgres, and env defaults that disable external AI providers.
- README documents the local E2E workflow (`pnpm exec playwright install`, `npx playwright install-deps`, migrate/seed) so contributors can mirror CI troubleshooting steps.

## Environment & docs
- `.env.example` and `.env.ci` document AI and webhook configuration.
- README updates (pending in this branch) will highlight RBAC roles, AI usage, and webhook setup.
