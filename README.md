# 🧠 Devlogia — Personal Blog CMS

> “Where logic meets narrative.” Devlogia is a modern, developer-centric personal blog CMS — fast, minimal, and built for deep writing.

## ✨ Highlights

- **Next.js 16 App Router** with MDX-powered publishing
- **Prisma + PostgreSQL** schema for users, posts, pages, media, and tags
- **NextAuth credentials** login with protected `/admin` middleware
- **MDX editor with autosave** (localStorage fallback & live preview)
- **AI Assist panel** for outlines, metadata, tags, and rephrasing (provider agnostic)
- **UploadThing stub** so the app is deploy-ready without external storage
- **Role-based admin** (owner/editor/writer) with audit logging and user management
- **SEO suite**: dynamic sitemap, RSS feed, canonical metadata, enriched OG images
- **Full-text search** with Postgres tsvector + tag filters on the home page
- **Cursor-based pagination** on public + admin listings with preserved filters
- **Accessibility polish**: share buttons, optional table of contents, skip links, focus rings
- **Analytics & newsletter flags** controlled via environment variables
- **Webhook revalidation** with HMAC signatures & rate limiting for safe cache busting
- **Vitest + Playwright** test harness with GitHub Actions-friendly scripts

## 🧱 Tech Stack

| Layer      | Tools |
| ---------- | ----- |
| Frontend   | Next.js 16, React 19, Tailwind CSS 4 |
| Backend    | App Router route handlers + Prisma ORM |
| Auth       | NextAuth (JWT sessions, email/password) |
| Database   | PostgreSQL |
| Editor     | MDX (remark/rehype), custom Callout component |
| Uploads    | UploadThing (stub provider) |
| Testing    | Vitest, Testing Library, Playwright |
| CI/CD      | GitHub Actions template (lint → typecheck → test → build) |

## 📦 Project Structure

```
devlogia/
├── prisma/
│   ├── schema.prisma      # Database models & enums
│   └── seed.ts            # Seeds admin user + sample content
├── src/
│   ├── app/
│   │   ├── (public)/      # Public-facing pages & blog routes
│   │   ├── (admin)/       # Admin dashboard & CRUD routes
│   │   ├── (auth)/        # Auth routes (admin login)
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

## ✅ Prerequisites

- **Node.js 20+** and **pnpm 8+** (`corepack enable pnpm` recommended)
- **PostgreSQL 14+** running locally (default credentials below) — or use the lightweight Docker Compose stack below
- Recommended: `psql` CLI for managing the database

### Quick start (local stack)

Spin up Postgres, install browsers, and run the checks end-to-end:

```bash
pnpm install

# Start the local Postgres container
pnpm db:up

# Apply schema & seed
pnpm prisma:migrate
pnpm prisma:seed

# Install Playwright dependencies (browsers + system packages)
pnpm exec playwright install --with-deps

# Validate the build pipeline
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Optional: launch E2E specs (requires the dev server)
pnpm test:e2e
```

Stop the services afterwards with `pnpm db:down`. To rebuild the database from scratch, run `pnpm db:reset`.

To automate the entire E2E workflow — including Docker Compose startup, migrations, seeding, browser installation, and the Playwright suite — run:

```bash
pnpm test:e2e:full
```

The script is idempotent: `pnpm db:up` is skipped automatically when the containers are already healthy or Docker Compose is not available (e.g., inside CI where a PostgreSQL service is provided).

## 🛠️ Local Troubleshooting

- **E2E specs exit early?** Ensure Docker Desktop (or your container runtime) is running, then execute `pnpm db:up` before retrying.
- **Prisma shows a build-time warning?** That message is safe to ignore when building static assets without a live database connection.

### E2E auto-seed behavior

Both the GitHub Actions pipeline and the `pnpm test:e2e:full` script ensure the database is migrated and seeded immediately before Playwright executes. This guarantees RBAC fixtures, webhook subscribers, and AI-assist content are present for every run without manual intervention.

1. `pnpm prisma migrate deploy` applies the latest schema to the target database.
2. `pnpm prisma db seed` repopulates deterministic users, posts, and supporting data.
3. The seeding step is safe to rerun — existing data is updated when necessary so parallel environments stay in sync.

### Running tests locally with Docker Compose

When Docker Compose is available, `pnpm db:up` launches the Postgres stack defined in `docker-compose.yml`. The command is automatically invoked by `pnpm test:e2e:full`, but you can run it manually to develop against the same containerized database used in CI. Shut the stack down with `pnpm db:down` once you finish testing.

### Environment Variables

Copy the template and adjust as needed:

```bash
cp .env.example .env
```

Defaults assume a local PostgreSQL server:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devlogia"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="changeme"
UPLOADTHING_SECRET="stub-dev"
UPLOADER_PROVIDER="stub"
SEED_OWNER_EMAIL="owner@devlogia.test"
SEED_OWNER_PASSWORD="owner123"
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
```

### Test environment variables

Use the provided `.env.test` template when running the automated test suites. It mirrors the CI defaults:

```bash
cp .env.test .env
```

The file pins a local PostgreSQL URL (`devlogia_test`), deterministic secrets, and disables external AI/webhook providers so unit and E2E tests run in isolation.

## 🚀 Local Development

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Apply Prisma migrations**

   ```bash
   pnpm prisma:migrate
   ```

3. **Seed the database** (creates owner/editor/writer accounts & sample content)

   ```bash
   pnpm prisma:seed
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) for the public site or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin portal.

### Database fallback

When `DATABASE_URL` is unset (for example during documentation builds or static previews), Prisma queries invoked during build-time rendering call a `safeFindMany` helper. The helper logs a friendly warning (`[Devlogia] DATABASE_URL missing — skipping query for <model>`) and returns an empty array so `pnpm build` succeeds even without a running database. Runtime mutations in the admin/API routes still require a real PostgreSQL connection.

### Seeded accounts

The seed script provisions three accounts for testing RBAC:

- **Owner:** `owner@devlogia.test` / `owner123`
- **Editor:** `editor@devlogia.test` / `editor123`
- **Writer:** `writer@devlogia.test` / `writer123`

Override these via `SEED_OWNER_*`, `SEED_EDITOR_*`, and `SEED_WRITER_*` before seeding.

## 🧪 Quality Gates & Scripts

The project follows a strict `lint → test → build` pipeline. Run all checks with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional scripts:

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Start Next.js development server |
| `pnpm lint` | ESLint via `next lint` |
| `pnpm typecheck` | TypeScript `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (jsdom) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright E2E tests (requires running PostgreSQL) |
| `pnpm build` | Production Next.js build |
| `pnpm prisma:migrate` | Apply migrations interactively |
| `pnpm prisma:seed` | Seed the database via `tsx prisma/seed.ts` |
| `pnpm format` | Prettier check |
| `pnpm format:write` | Prettier write |

### Running Playwright Tests

Playwright spins up the Next.js dev server automatically. Ensure your PostgreSQL instance is running and populated (migration + seed) before executing:

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

- Ensure the `postgres` container is healthy (`pnpm db:up` and `docker compose ps`).
- Delete Playwright's cache if browsers look stale: `rm -rf ~/.cache/ms-playwright`.
- Rebuild the database if tests rely on a clean slate: `pnpm db:reset`.

The E2E spec logs in as the seeded owner, creates a new post via the editor (autosave + publish), and verifies it appears on the public blog.

CI uses the official `mcr.microsoft.com/playwright:v1.47.0-jammy` image with browsers preinstalled. We cache `~/.cache/ms-playwright` and set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to avoid redundant downloads, then run migrations, lint/typecheck/unit/build, and finally launch the app for Playwright.

### Upgrade path from v1.0.0-rc → v1.0.0

Upgrading from the release candidate is seamless — configuration keys remain the same and the schema changes are already captured in migrations. To adopt the stable tag:

1. Pull the `v1.0.0` tag (or merge the `release/v1.0.0` branch) and rerun `pnpm install` to ensure lockfile parity.
2. Apply the production schema with `pnpm prisma migrate deploy`.
3. Seed the deterministic accounts and demo content using `pnpm prisma db seed` (safe to rerun in place).
4. Optionally execute `pnpm test:e2e:full` to validate RBAC, webhook, and AI-assist flows under the new seeding automation.

Refer to `docs/release-notes/v1.0.0.md` for the complete changelog.

## 🛠️ Admin & Editor Workflow

- `/admin/login` — Credentials sign-in backed by NextAuth JWT sessions
- `/admin/dashboard` — Content health stats & recent activity
- `/admin/posts` — Filterable list of posts (Draft, Published, Scheduled)
- `/admin/posts/new` — MDX editor with autosave (1500 ms debounce, offline-safe)
- `/admin/posts/[id]` — Edit existing posts with tag management & status changes
- `/admin/pages` — Minimal CRUD for static pages with live preview on `/<slug>`
- `/admin/users` — Owner-only user management with role assignments

### Editor Features

- Autosave persists to the database (and localStorage as a fallback)
- Live MDX preview using the same rendering pipeline as the public site
- AI Assist panel for outlines, metadata, tags, and rephrasing (disabled when no provider configured)
- Custom MDX components such as `<Callout>` are supported out of the box
- Tag input accepts comma-separated values and creates tags automatically

## 🌐 SEO & Feeds

- `GET /api/sitemap` — Dynamic sitemap including posts and published pages
- `GET /api/rss` — RSS feed with MDX content enclosed in CDATA
- `GET /api/og` — Dynamic Open Graph image generator (title → PNG via `next/og`)
- Default metadata (title template, OpenGraph, Twitter cards) via `siteConfig`
- Canonical URLs derived from `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL`
- `public/og-default.png` ships as a text placeholder — swap with your own branded asset in production

## 🔍 Search & Discovery

- Home page search uses Postgres `tsvector` + `plainto_tsquery` for relevance-ranked results
- Tag filters are encoded in the query string and combinable with full-text search
- Pagination preserves active filters to keep the browsing context intact

## ♻️ Uploads

UploadThing is configured with a **stub provider** for local development and test environments. The `/api/uploadthing` route authenticates the admin, stores metadata in the `Media` table, and returns a deterministic fake URL (e.g. `/uploads/{id}.png`). Swap `UPLOADER_PROVIDER` when wiring a real provider (R2/S3) in future phases.

## 📊 Analytics & Newsletter

- Toggle analytics by setting `ANALYTICS_PROVIDER` to `plausible` or `umami`. Scripts load after hydration and respect the browser’s Do-Not-Track preference.
- Configure `ANALYTICS_DOMAIN`, `ANALYTICS_SCRIPT_URL`, and `ANALYTICS_WEBSITE_ID` as required by your provider.
- The `/subscribe` page surfaces a Buttondown or Resend form when `NEWSLETTER_PROVIDER` and credentials are present; otherwise the UI displays a “coming soon” callout.

## 🧪 Testing Details

- **Unit tests**: Vitest + Testing Library cover key flows (Home page rendering, admin login form validation, utility functions)
- **E2E tests**: Playwright scripts now cover publishing, media uploads, OG rendering, and search/pagination flows
- **CI ready**: lint → typecheck → test → build flow suitable for GitHub Actions

## 📄 License

MIT © 2025 Devlogia contributors. Crafted with ❤️ for long-form writing.
