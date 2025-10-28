# Contributing to Devlogia

Thanks for helping improve Devlogia! This guide outlines the expectations for contributors and the quickest path to a green PR.

## 🧭 Project workflow

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Copy environment defaults and reset the database**
   ```bash
   cp .env.example .env
   pnpm db:reset
   ```
3. **Start the dev server**
   ```bash
   pnpm dev
   ```

Admin credentials are seeded automatically (e.g. `owner@devlogia.test` / `owner123`).

## 🌿 Branching & commits

- Use the provided feature branches when possible (`feature/ux-polish`, `feature/api-docs`, `feature/perf-improve`, `feature/devx`).
- Keep commits focused; reference user stories or issues in the message body when relevant.

## ✅ Pre-PR checklist

Run the same commands that GitHub Actions executes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If you touched API schemas or route handlers, regenerate the OpenAPI bundle and commit it:

```bash
pnpm openapi:generate
```

For major UI updates, capture a screenshot and attach it to the PR.

## 🧪 Testing tips

- `pnpm test` executes the Vitest suite with coverage.
- `pnpm test:e2e` runs the Playwright specs (requires `pnpm dev` in another terminal).
- `pnpm analyze` builds the Next.js bundle with the analyzer enabled — helpful when working on performance issues.

## 🗄️ Database utilities

- `pnpm db:reset` drops, migrates, and re-seeds the database. Use it whenever you need a clean slate.
- `pnpm db:up` / `pnpm db:down` manage the optional Docker Compose PostgreSQL stack.

## 📦 OpenAPI outputs

- `/api/docs` renders the MDX-powered reference using the generated schema.
- `/api/openapi.json` mirrors the data consumed by tools and the SwaggerHub upload job.
- `openapi.yaml` should always reflect the latest schema — regenerate it with `pnpm openapi:generate` before merging API changes.

Happy shipping! 🚀
