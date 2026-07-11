# Phase 12 — Ecosystem Launch & Developer Portal

## Current Status

Phase 12 is **not part of the current CMS/blog release scope**. Treat this document as a backlog and design brief for a future ecosystem launch.

The current production release is limited to the CMS/blog product: public `/blog`, post/page publishing, media uploads, admin auth/RBAC, SEO feeds, and the related Playwright E2E/visual smoke coverage.

Before Phase 12 can be promoted to release scope, complete the following prerequisites:

- Add Prisma migrations for the ecosystem, partner, submission, review, plugin, extension, billing, and workspace tables that are referenced by schema or planned API flows.
- Fix the current TypeScript gate, including the marketplace checkout product payload type issue.
- Build complete admin/partner UI flows for publishing, review, installation, entitlement, billing, and webhook testing.
- Add E2E coverage for submission review, plugin installation, extension registration, checkout, webhook delivery, and developer portal playground flows.
- Document production environment variables and failure modes for DocSearch, webhook signing, plugin scanning, billing, and sandbox credentials.

## 🎯 Objective

Deliver a production-ready developer ecosystem that enables external builders to ship Devlogia plugins and AI extensions end-to-end with clear governance, quality signals, and a delightful onboarding experience.

## 🌐 Developer Portal Rollout (/developers)

- Next.js microsite mounted under `/developers` with doc sidebar, global search (Algolia DocSearch), tabbed code samples, copy buttons, and dark mode parity.
- Content pillars: Authentication & RBAC, SDK usage (JavaScript/TypeScript), Plugin API, AI Extension API, Webhooks (signing & retries), Marketplace distribution, Monetization.
- Embedded OpenAPI Explorer powered by `openapi.yaml` → Swagger UI + REST console (sandbox base URL + dev token input).
- Starter sandbox key provisioning flow (one-click create from portal) with rate limits and revoke option.
- Cookbook library with runnable recipes (billing integration, entitlement checks, federated queries).
- Examples directory mirrored to GitHub templates; ensure `pnpm exec docs:examples-build` validates builds.

## 🚀 Submission & Review Workflow

1. **Partner onboarding** — `/api/partners/register` (superadmin only) seeds Partner, optional webhook subscription, returns partner console access.
2. **Submission draft** — Partner uploads `manifest.json`, repository URL, semantic version, scope permissions; stored in `Submission` table with `status=draft`.
3. **Automated validation** — Trigger `ecosystem:scan` script: manifest linter, dependency audit (using `PLUGIN_SCAN_TOKEN`), license compliance check, AI prompt moderation; failing high-severity flags auto-reject.
4. **Review queue** — Internal console lists `status=in_review` submissions with diff viewer, checklists, simulated install.
5. **Decision** — Reviewer posts `/api/reviews/:id/decision` with checklist JSON + comments; status transitions to `approved` or `rejected` and quality badges issued.
6. **Partner visibility** — `/api/submissions/:id/status` streams updates (SSE or polling). Approved assets unlock publish toggle in marketplace & AI Hub.

## 🛡️ Quality & Security Gates

- Static analysis coverage: dependency SBOM (CycloneDX), known CVEs (OSV), secret scan, permission scope diff vs. previous versions.
- Runtime smoke tests: `submissionFlow.e2e.ts` executes install → handshake → webhook callback (HMAC verified via `WEBHOOK_SIGNING_KEY`).
- AI moderation pipeline (prompt/response dataset) with policy tiers; failing prompts require remediation before resubmission.
- Webhook tester `/api/webhooks/test` signs payload with partner secret; portal shows signature + delivery log.
- Automated badge issuance (`QualityBadge` table) for verified partners, security scanned submissions, accessibility & performance compliance.

## 🧩 Versioning, Changelog & Deprecation

- Enforce semver on plugin/extension manifest & SDK packages; reject retrograde versions during submission.
- Generate `CHANGELOG.md` via `pnpm ecosystem:changelog` pulling merged PR labels (feat/fix/breaking) and attaching compatibility notes.
- Maintain compatibility matrix (SDK ↔ API ↔ Plugin API level) within docs; highlight minimum required SDK version for each API change.
- Deprecation policy: 60-day notice with phased warnings (portal banner, SDK console warning, webhook `deprecation.notice` event).
- Provide `ecosystem:webhook:test` to validate partner listeners for upcoming deprecations.

## 🧰 Samples, Starters & CLI

- Publish TypeScript starter kits: `plugin-ui`, `server-webhook`, `ai-extension`; each with `pnpm lint && pnpm test && pnpm dev` instructions and CI badges.
- CLI `devlogia create` (packages/cli) scaffolds selected template, injects partner ID + sandbox key, configures `.env` and recommended scripts.
- Include advanced samples covering billing hooks, entitlement middleware, federated knowledge base queries, and observability integrations (OpenTelemetry exporters).

## 📣 DevRel Ops & Launch Plan

- Landing page "Build with Devlogia" + blog announcement + changelog entry; sync marketing launch to `MARKETING_LAUNCH_AT`.
- Partner Founders cohort (first 10 teams) with SLA: support response < 24h, dedicated Discord channel, office hours, co-marketing kit.
- Telemetry dashboards: track `sdk_installs`, `submission_created`, `submission_approval_rate (≥60%)`, `avg_review_time_hours (≤72)`, `playground_requests`, `webhook_fail_rate (≤1%)`.
- Feedback loop: portal banner linking to post-launch survey, triage results during weekly ecosystem standup.

## 🗄️ Data Model & APIs

- **Tables:** `Partner`, `Submission`, `Review`, `QualityBadge`, `WebhookSubscription` (see schema changes in migration backlog).
- **Key API routes:**
  - `POST /api/partners/register` — superadmin partner creation + default roles.
  - `POST /api/submissions` — partner submission intake.
  - `GET /api/submissions/:id/status` — real-time status view.
  - `POST /api/reviews/:id/decision` — reviewer decision + badge issuance.
  - `POST /api/webhooks/test` — send signed test event.
  - `GET /api/docs/openapi.json` — canonical schema powering portal explorer & SDK generation.

## 🔐 Environment Variables

Add to platform secrets management and `.env.example` as needed:

- `DOCS_SEARCH_APP_ID`, `DOCS_SEARCH_API_KEY` — Algolia DocSearch credentials.
- `WEBHOOK_SIGNING_KEY` — HMAC secret for webhook signatures and replay protection.
- `PLUGIN_SCAN_TOKEN` — access token for static scan service.
- `MARKETING_LAUNCH_AT` — ISO timestamp used for launch gating and countdown components.

## ✅ Readiness Checklist

- [ ] `/developers` portal deployed, search indexed, and examples verified via CI (`docs_ci` jobs: `links-validate`, `openapi-validate`, `examples-build`).
- [ ] Submission workflow (draft → in_review → approved/rejected) validated through `submissionFlow.e2e.ts` with quality badges emitted.
- [ ] Security & moderation gates enforced; high severity issues auto-fail; reports surfaced to partners.
- [ ] Versioning + changelog automation in place; deprecation warnings visible in portal + SDK.
- [ ] Starter kits, CLI scaffolder, and launch assets published; telemetry dashboards tracking launch KPIs.
