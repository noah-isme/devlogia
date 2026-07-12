# Devlogia — Personal Blog CMS

> “Where logic meets narrative.” Devlogia is a modern, developer-centric personal blog CMS — fast, minimal, and built for deep writing.

## Release Scope

The current release scope is the **CMS/blog product**: public blog browsing, post/page publishing, media uploads, admin authentication, RBAC, SEO feeds, and the automated test harness around those flows.

The repository also contains platform work for AI recommendations, tenant workspaces, marketplace billing, federation, and developer ecosystem features. Those areas are treated as **beta/foundation code** for now. They should not be positioned as production-ready release scope until their migrations, type checks, UI workflows, and E2E coverage are completed.

Current release-gate status:

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass for the current CMS/blog release gate.
- Full E2E coverage remains the final local/staging confirmation step before promotion.

## Highlights

- **Next.js 16 App Router** with MDX-powered publishing
- **Prisma + MySQL** schema for users, posts, pages, media, and tags
- **NextAuth credentials** login with protected `/admin` middleware
- **MDX editor with autosave** (localStorage fallback & live preview)
- **Supabase Storage integration** with a local stub fallback for CI and offline development
- **Role-based admin** (superadmin/admin/editor/writer) with audit logging and user management
- **Unified admin workspace** with sticky sidebar navigation, WCAG AA contrast, and a persistent dark/light theme toggle
- **SEO suite**: dynamic sitemap, RSS feed, canonical metadata, enriched OG images
- **Blog search** powered by Prisma filters and tag metadata (MySQL-compatible)
- **Cursor-based pagination** on public + admin listings with preserved filters
- **Accessibility polish**: share buttons, optional table of contents, skip links, focus rings
- **Analytics & newsletter flags** controlled via environment variables
- **Webhook revalidation** with HMAC signatures & rate limiting for safe cache busting
- **Vitest + Playwright** test harness with GitHub Actions-friendly scripts
- **OpenAPI-powered developer docs** (`/api/docs`, `/api/openapi.json`, `openapi.yaml`) for instant SDK and Postman imports

### Beta / Foundation Areas

These modules exist in code but are outside the CMS/blog release commitment:

- AI assist, recommendations, embeddings, topic clustering, and AI usage reporting.
- Multi-tenant workspaces and realtime collaboration.
- Marketplace plugins, extensions, Stripe checkout, revenue split, and payouts.
- Federation dashboards and cross-tenant recommendation queries.
- Developer portal submission/review workflows and SDK publishing flows.

Before promoting these areas, complete the missing Prisma migrations, fix typecheck, add release-grade UI flows, and cover them with targeted E2E tests.

## Tech Stack

| Layer    | Tools                                                     |
| -------- | --------------------------------------------------------- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4                      |
| Backend  | App Router route handlers + Prisma ORM                    |
| Auth     | NextAuth (JWT sessions, email/password)                   |
| Database | MySQL                                                     |
| Editor   | MDX (remark/rehype), custom Callout component             |
| Uploads  | Supabase Storage (stub fallback)                          |
| Testing  | Vitest, Testing Library, Playwright                       |
| CI/CD    | GitHub Actions template (lint → typecheck → test → build) |

## Project Structure

```
devlogia/
├── prisma/
│   ├── schema.prisma      # Database models & enums
│   └── seed.ts            # Seeds admin user + sample content
├── src/
│   ├── app/
│   │   ├── (public)/      # Public-facing pages & blog routes
│   │   ├── admin/         # Admin login + console route groups
│   │   └── api/           # Route handlers (auth, posts, pages, rss, etc.)
│   ├── components/        # UI primitives, forms, editor widgets
│   ├── lib/               # Prisma client, auth, seo, mdx, helpers
│   ├── mdx-components/    # Custom MDX components (Callout, code blocks)
│   ├── styles/            # Tailwind globals
│   └── types/             # Type augmentations (NextAuth)
├── public/                # Static assets (favicon, OG image)
├── tests/e2e/             # Playwright specs
├── vitest.config.ts       # Vitest setup
└── playwright.config.ts   # Playwright setup
```

## Prerequisites

- **Node.js 20+** and **pnpm 8+** (`corepack enable pnpm` recommended)
- **MySQL 8+** running locally (default credentials below) — or use the lightweight Docker Compose stack below
- Recommended: `mysql` CLI for managing the database

### 3-step local setup

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Bootstrap the database (drops + migrates + seeds)

   ```bash
   cp .env.example .env
   pnpm db:reset
   ```

3. Start the development server

   ```bash
   pnpm dev
   ```

The admin dashboard lives at [`http://localhost:3000/admin`](http://localhost:3000/admin). Use the seeded credentials from `.env` (e.g. `owner@devlogia.test` / `owner123`).

### Full pipeline (optional)

When you need to mirror CI locally — including browser installation and every check in the GitHub Actions workflow — run:

```bash
pnpm install
pnpm db:up
pnpm db:reset
pnpm exec playwright install --with-deps
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Stop the containerised database afterwards with `pnpm db:down`. To execute the one-shot integration runner (Docker + migrations + seeding + Playwright), use `pnpm test:e2e:full`.

## Local Troubleshooting

- **E2E specs exit early?** Ensure Docker Desktop (or your container runtime) is running, then execute `pnpm db:up` before retrying.
- **Prisma shows a build-time warning?** That message is safe to ignore when building static assets without a live database connection.

### E2E auto-seed behavior

Both the GitHub Actions pipeline and the `pnpm test:e2e:full` script ensure the database is migrated and seeded immediately before Playwright executes. This guarantees RBAC fixtures, webhook subscribers, and AI-assist content are present for every run without manual intervention.

1. `pnpm prisma migrate deploy` applies the latest schema to the target database.
2. `pnpm prisma db seed` repopulates deterministic users, posts, and supporting data.
3. The seeding step is safe to rerun — existing data is updated when necessary so parallel environments stay in sync.

### Running tests locally with Docker Compose

When Docker Compose is available, `pnpm db:up` launches the MySQL stack defined in `docker-compose.yml`. The command is automatically invoked by `pnpm test:e2e:full`, but you can run it manually to develop against the same containerized database used in CI. Shut the stack down with `pnpm db:down` once you finish testing.

## Developer API Documentation

- Visit [`/api/docs`](http://localhost:3000/api/docs) for the interactive MDX reference with request/response examples generated from the OpenAPI schema.
- Programmatic consumers can fetch [`/api/openapi.json`](http://localhost:3000/api/openapi.json) or use the checked-in `openapi.yaml` file for Postman, Swagger UI, or SDK generation.
- Regenerate the schema after editing public APIs with `pnpm openapi:generate`.

### Environment Variables

Copy the template and adjust as needed:

```bash
cp .env.example .env
```

Defaults assume a local MySQL server:

```
DATABASE_URL="mysql://root:root@localhost:3306/devlogia"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="changeme"
SUPABASE_URL="https://<project-id>.supabase.co"
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="devlogia-media"
NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_BUCKET="${SUPABASE_STORAGE_BUCKET}"
SEED_SUPERADMIN_EMAIL="owner@devlogia.test"
SEED_SUPERADMIN_PASSWORD="owner123"
SEED_ADMIN_EMAIL="admin@devlogia.test"
SEED_ADMIN_PASSWORD="admin123"
SEED_EDITOR_EMAIL="editor@devlogia.test"
SEED_EDITOR_PASSWORD="editor123"
SEED_WRITER_EMAIL="writer@devlogia.test"
SEED_WRITER_PASSWORD="writer123"
AI_PROVIDER="none" # "openai" | "hf" | "none"
OPENAI_API_KEY=""
HF_API_KEY=""
AI_RATE_LIMIT_PER_MIN="30"
WEBHOOKS_OUTBOUND_URLS="[]"
WEBHOOKS_SIGNING_SECRET="devlogia-signature"

# Optional analytics & newsletter flags
ANALYTICS_PROVIDER=""
ANALYTICS_DOMAIN=""
ANALYTICS_SCRIPT_URL=""
ANALYTICS_WEBSITE_ID=""
NEWSLETTER_PROVIDER=""
BUTTONDOWN_API_KEY=""
RESEND_API_KEY=""
RESEND_AUDIENCE_ID=""
SUPABASE_MAX_FILE_SIZE_MB="10"
SUPABASE_ALLOWED_MIME_TYPES="image/*,video/*,audio/*,application/pdf,text/plain"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MAINTENANCE_MODE="false"
LOGTAIL_TOKEN=""
RATE_LIMIT_REDIS_URL="redis://localhost:6379/0"
RATE_LIMIT_ALLOWLIST=""
SUBSCRIBE_RATE_LIMIT="10"
SUBSCRIBE_RATE_LIMIT_WINDOW_MS="60000"
POSTS_RATE_LIMIT="120"
POSTS_RATE_LIMIT_WINDOW_MS="60000"
PAGES_RATE_LIMIT="120"
PAGES_RATE_LIMIT_WINDOW_MS="60000"
RSS_RATE_LIMIT="120"
RSS_RATE_LIMIT_WINDOW_MS="60000"
SITEMAP_RATE_LIMIT="120"
SITEMAP_RATE_LIMIT_WINDOW_MS="60000"
SENTRY_DSN=""
SENTRY_TRACES_SAMPLE_RATE="0.1"
SENTRY_PROFILES_SAMPLE_RATE="0"
SENTRY_ENVIRONMENT="development"
CSP_REPORT_URI=""
```

### Test environment variables

Use the provided `.env.test` template when running the automated test suites. It mirrors the CI defaults:

```bash
cp .env.test .env
```

The file pins a local MySQL URL (`devlogia_test`), deterministic secrets, and disables external AI/webhook providers so unit and E2E tests run in isolation.

## Local Development

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Apply Prisma migrations**

   ```bash
   pnpm prisma:migrate
   ```

3. **Seed the database** (creates superadmin/admin/editor/writer accounts & sample content)

   ```bash
   pnpm prisma:seed
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) for the public site or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin portal.

### Database fallback

When `DATABASE_URL` is unset (for example during documentation builds or static previews), Prisma queries invoked during build-time rendering call a `safeFindMany` helper. The helper logs a friendly warning (`[Devlogia] DATABASE_URL missing — skipping query for <model>`) and returns an empty array so `pnpm build` succeeds even without a running database. Runtime mutations in the admin/API routes still require a real MySQL connection.

### Seeded accounts

The seed script provisions four accounts for testing RBAC:

- **Superadmin:** `owner@devlogia.test` / `owner123`
- **Admin:** `admin@devlogia.test` / `admin123`
- **Editor:** `editor@devlogia.test` / `editor123`
- **Writer:** `writer@devlogia.test` / `writer123`

Override these via `SEED_SUPERADMIN_*`, `SEED_ADMIN_*`, `SEED_EDITOR_*`, and `SEED_WRITER_*` before seeding.

## Quality Gates & Scripts

The CMS/blog release gate is:

```bash
pnpm test
pnpm test:e2e:full
```

Before a production release, also run the full engineering gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:full
```

At the time of this audit, the Playwright CMS/blog suite is passing, while `pnpm typecheck` is blocked by the beta marketplace checkout type issue noted above.

Additional scripts:

| Script                | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`            | Start Next.js development server                                             |
| `pnpm lint`           | ESLint via `next lint`                                                       |
| `pnpm typecheck`      | TypeScript `tsc --noEmit`                                                    |
| `pnpm test`           | Vitest unit tests (jsdom)                                                    |
| `pnpm test:watch`     | Vitest in watch mode                                                         |
| `pnpm test:e2e`       | Playwright E2E tests (starts the configured web server and requires MySQL)   |
| `pnpm test:e2e:full`  | Docker + test database + seed + Playwright runner for the CMS/blog E2E suite |
| `pnpm build`          | Production Next.js build                                                     |
| `pnpm prisma:migrate` | Apply migrations interactively                                               |
| `pnpm prisma:seed`    | Seed the database via `tsx prisma/seed.ts`                                   |
| `pnpm format`         | Prettier check                                                               |
| `pnpm format:write`   | Prettier write                                                               |

### Running Playwright Tests

Playwright spins up the Next.js dev server automatically. Ensure your MySQL instance is running and populated (migration + seed) before executing:

```bash
# one-time browser + dependency install
pnpm exec playwright install --with-deps

# prepare the database
pnpm prisma:migrate
pnpm prisma:seed

# run the spec suite
pnpm test:e2e
```

Troubleshooting tips:

- Ensure the `mysql` container is healthy (`pnpm db:up` and `docker compose ps`).
- Delete Playwright's cache if browsers look stale: `rm -rf ~/.cache/ms-playwright`.
- Rebuild the database if tests rely on a clean slate: `pnpm db:reset`.

The E2E suite logs in as seeded users, validates admin auth and RBAC, creates and edits posts/pages, uploads media, publishes content, validates public blog search/pagination, checks OG rendering, and writes visual smoke screenshots for login, dashboard, blog, and the new-post editor.

Screenshots are stored under `test-results/visual-smoke-*` and attached to the Playwright HTML report.

### Upgrade path from v1.0.0-rc → v1.0.0

Upgrading from the release candidate is seamless — configuration keys remain the same and the schema changes are already captured in migrations. To adopt the stable tag:

1. Pull the `v1.0.0` tag (or merge the `release/v1.0.0` branch) and rerun `pnpm install` to ensure lockfile parity.
2. Apply the production schema with `pnpm prisma migrate deploy`.
3. Seed the deterministic accounts and demo content using `pnpm prisma db seed` (safe to rerun in place).
4. Optionally execute `pnpm test:e2e:full` to validate the CMS/blog flows under the current seeding automation.

Refer to `docs/release-notes/v1.0.0.md` for the complete changelog.

## Admin & Editor Workflow

- `/admin/login` — Credentials sign-in backed by NextAuth JWT sessions
- `/admin/dashboard` — Content health stats & recent activity
- `/admin/posts` — Filterable list of posts (Draft, Published, Scheduled)
- `/admin/posts/new` — MDX editor with autosave (1500 ms debounce, offline-safe)
- `/admin/posts/[id]` — Edit existing posts with tag management & status changes
- `/admin/pages` — Minimal CRUD for static pages with live preview on `/<slug>`
- `/admin/users` — Superadmin-only user management with RBAC roles and status controls
- `/admin/analytics` — Superadmin analytics dashboard with live refresh charts

### Editor Features

- Autosave persists to the database (and localStorage as a fallback)
- Live MDX preview using the same rendering pipeline as the public site
- Custom MDX components such as `<Callout>` are supported out of the box
- Tag input accepts comma-separated values and creates tags automatically

AI editor panels are available as beta functionality and remain disabled when no provider is configured.

## SEO & Feeds

- `GET /api/sitemap` — Dynamic sitemap including posts and published pages
- `GET /api/rss` — RSS feed with MDX content enclosed in CDATA
- `GET /api/og` — Dynamic Open Graph image generator (title → PNG via `next/og`)
- Default metadata (title template, OpenGraph, Twitter cards) via `siteConfig`
- Canonical URLs derived from `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL`
- `public/og-default.png` ships as a text placeholder — swap with your own branded asset in production

## Search & Discovery

- `/blog` search uses Prisma `contains` filters with case-insensitive comparisons for MySQL compatibility.
- Tag filters are encoded in the query string and combinable with full-text search
- Pagination preserves active filters to keep the browsing context intact
- `/` is the landing page; the public article index is `/blog`.

## Uploads

Supabase Storage powers uploads in production. Provide `SUPABASE_*` credentials to stream media to your bucket; otherwise Devlogia falls back to a local `/public/uploads` stub so CI and offline development stay deterministic.

## Analytics & Newsletter

- Toggle analytics by setting `ANALYTICS_PROVIDER` to `plausible` or `umami`. Scripts load after hydration and respect the browser’s Do-Not-Track preference.
- Configure `ANALYTICS_DOMAIN`, `ANALYTICS_SCRIPT_URL`, and `ANALYTICS_WEBSITE_ID` as required by your provider.
- The `/subscribe` page surfaces a Buttondown or Resend form when `NEWSLETTER_PROVIDER` and credentials are present; otherwise the UI displays a “coming soon” callout.

## Testing Details

- **Unit tests**: Vitest + Testing Library cover key flows (Home page rendering, admin login form validation, utility functions)
- **E2E tests**: Playwright scripts cover login, RBAC, publishing, media uploads, OG rendering, search/pagination, and visual smoke screenshots
- **Current audit status**: Playwright E2E last run is passing; full release gate remains blocked until the marketplace checkout typecheck error is fixed

## License

MIT © 2025 Devlogia contributors.
