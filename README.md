# 🧠 Devlogia — Personal Blog CMS

> “Where logic meets narrative.” Devlogia is a modern, developer-centric personal blog CMS — fast, minimal, and built for deep writing.

## ✨ Highlights

- **Next.js 16 App Router** with MDX-powered publishing
- **Prisma + PostgreSQL** schema for users, posts, pages, media, and tags
- **NextAuth credentials** login with protected `/admin` middleware
- **MDX editor with autosave** (localStorage fallback & live preview)
- **UploadThing stub** so the app is deploy-ready without external storage
- **SEO suite**: dynamic sitemap, RSS feed, canonical metadata, OG image
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
- **PostgreSQL 14+** running locally (default credentials below)
- Recommended: `psql` CLI for managing the database

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
UPLOADTHING_SECRET="changeme"
UPLOADER_PROVIDER="stub"
SEED_ADMIN_EMAIL="admin@devlogia.test"
SEED_ADMIN_PASSWORD="admin123"
```

## 🚀 Local Development

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Apply Prisma migrations**

   ```bash
   pnpm prisma:migrate
   ```

3. **Seed the database** (creates an admin user & sample content)

   ```bash
   pnpm prisma:seed
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) for the public site or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin portal.

### Admin Credentials

The seed script provisions a default admin account:

- **Email:** `admin@devlogia.test`
- **Password:** `admin123`

You can customise these via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding.

## 🧪 Quality Gates & Scripts

The project follows a strict `lint → test → build` pipeline. Run all checks with:

```bash
pnpm lint
pnpm test
pnpm typecheck
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
| `pnpm e2e` | Playwright E2E tests (requires running PostgreSQL) |
| `pnpm build` | Production Next.js build |
| `pnpm prisma:migrate` | Apply migrations interactively |
| `pnpm prisma:seed` | Seed the database via `tsx prisma/seed.ts` |
| `pnpm format` | Prettier check |
| `pnpm format:write` | Prettier write |

### Running Playwright Tests

Playwright spins up the Next.js dev server automatically. Ensure your PostgreSQL instance is running and populated (migration + seed) before executing:

```bash
pnpm prisma:migrate
pnpm prisma:seed
pnpm e2e
```

The E2E spec logs in as the seeded admin, creates a new post via the editor (autosave + publish), and verifies it appears on the public blog.

## 🛠️ Admin & Editor Workflow

- `/admin/login` — Credentials sign-in backed by NextAuth JWT sessions
- `/admin/dashboard` — Content health stats & recent activity
- `/admin/posts` — Filterable list of posts (Draft, Published, Scheduled)
- `/admin/posts/new` — MDX editor with autosave (1500 ms debounce, offline-safe)
- `/admin/posts/[id]` — Edit existing posts with tag management & status changes
- `/admin/pages` — Minimal CRUD for static pages with live preview on `/<slug>`

### Editor Features

- Autosave persists to the database (and localStorage as a fallback)
- Live MDX preview using the same rendering pipeline as the public site
- Custom MDX components such as `<Callout>` are supported out of the box
- Tag input accepts comma-separated values and creates tags automatically

## 🌐 SEO & Feeds

- `GET /api/sitemap` — Dynamic sitemap including posts and published pages
- `GET /api/rss` — RSS feed with MDX content enclosed in CDATA
- Default metadata (title template, OpenGraph, Twitter cards) via `siteConfig`
- Canonical URLs derived from `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL`

## ♻️ Uploads

UploadThing is configured with a **stub provider** for local development and test environments. The `/api/uploadthing` route returns a fake path without storing files, making it safe to deploy without cloud storage credentials. Swap `UPLOADER_PROVIDER` when wiring a real provider (R2/S3) in future phases.

## 🧪 Testing Details

- **Unit tests**: Vitest + Testing Library cover key flows (Home page rendering, admin login form validation, utility functions)
- **E2E tests**: Playwright script validates the core publishing workflow
- **CI ready**: lint → typecheck → test → build flow suitable for GitHub Actions

## 📄 License

MIT © 2025 Devlogia contributors. Crafted with ❤️ for long-form writing.
