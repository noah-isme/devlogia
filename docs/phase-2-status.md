# Phase 2 — CI + Polish Status

## ✅ Delivered Enhancements

- GitHub Actions workflow provisions PostgreSQL 15, runs Prisma migrations/seeds, and executes lint → typecheck → unit → build → Playwright E2E.
- Cursor-based pagination on the public home and admin posts pages with preserved search/tag filters.
- Open Graph generator redesigned with title/tag/date overlays and graceful fallback to `og-default.png`.
- Analytics loader that respects Do Not Track and supports Plausible or Umami via `ANALYTICS_*` variables.
- Newsletter opt-in at `/subscribe` with provider-aware API route (`buttondown` or `resend`) and a friendly fallback state.
- Share buttons, table of contents, focus rings, and skip links to tighten accessibility on post detail pages.
- Seeder upgraded to create 12+ published posts, tags, and richer MDX content for pagination/search testing.
- New Playwright specs (`media-upload-and-attach`, `search-and-pagination`) alongside existing publish flow coverage.

## 🧪 Running the Full Pipeline Locally

```bash
# 1) Start PostgreSQL (Docker example)
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=devlogia \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15

# 2) Install deps & prepare DB
pnpm install
pnpm prisma migrate deploy
pnpm prisma db seed

# 3) Execute the same checks as CI
pnpm lint
pnpm typecheck
pnpm test
CI=1 pnpm build
pnpm exec playwright install --with-deps
pnpm test:e2e
```

> Tip: copy `.env.example` to `.env` or use `.env.ci` when mirroring the CI environment.

## 🔌 Feature Flags & Environment Variables

| Feature      | Variables |
| ------------ | --------- |
| Analytics    | `ANALYTICS_PROVIDER`, `ANALYTICS_DOMAIN`, `ANALYTICS_SCRIPT_URL`, `ANALYTICS_WEBSITE_ID` |
| Newsletter   | `NEWSLETTER_PROVIDER`, `BUTTONDOWN_API_KEY`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` |
| Uploads      | `UPLOADTHING_PROVIDER`, `S3_*` credentials (stub by default) |

Leave providers blank to disable the feature—the UI degrades gracefully.

## 📌 Notes

- OG endpoints accept `title`, `tag`, `slug`, and `date` query parameters; use `buildOgImageUrl` helper in metadata.
- Playwright specs rely on seeded credentials (`SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`).
- No binary assets were added; OG fallback still references `public/og-default.png`.
