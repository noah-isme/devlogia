# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the Next.js app router (`app/`), UI components, shared libraries, and types.
- `prisma/` contains the database schema and seed script.
- `tests/e2e/` holds Playwright specs; unit tests live in `src/**/__tests__/` and `tests/`.
- `packages/sdk/` ships the SDK build artifacts (`packages/sdk/dist`).
- `public/` stores static assets, while `openapi.yaml` is the generated API schema.

## Build, Test, and Development Commands
- `pnpm dev` runs the Next.js dev server.
- `pnpm build` / `pnpm start` build and serve the production bundle.
- `pnpm lint` and `pnpm typecheck` run ESLint and TypeScript checks.
- `pnpm test` / `pnpm test:watch` run the Vitest suite (watch for local dev).
- `pnpm test:e2e` runs Playwright (requires a running app); `pnpm test:e2e:full` runs the full Docker + seed + Playwright flow.
- `pnpm db:up` / `pnpm db:down` manage the Dockerized MySQL stack; `pnpm db:reset` resets and seeds.
- `pnpm openapi:generate` regenerates `openapi.yaml` after API changes.

## Coding Style & Naming Conventions
- TypeScript/TSX code is formatted by Prettier (`pnpm format`, `pnpm format:write`).
- ESLint is enforced via `eslint.config.mjs`; keep lint clean before opening a PR.
- Follow Next.js app router conventions under `src/app/` (route groups like `(public)`/`(admin)`).
- Tests use `.test.ts`/`.spec.ts` naming and live under `__tests__` or `tests/`.

## Testing Guidelines
- Unit tests run with Vitest + Testing Library and live alongside code in `src/**/__tests__/`.
- E2E tests live in `tests/e2e/*.spec.ts` and use Playwright.
- Use `.env.test` when running automated suites locally (`cp .env.test .env`).

## Commit & Pull Request Guidelines
- Prefer the existing feature branch naming patterns (e.g., `feature/ux-polish`).
- Keep commits focused; reference user stories or issues in the commit body when relevant.
- Before PRs, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- If API routes or schemas change, regenerate and commit `openapi.yaml`.
- For major UI updates, include a screenshot in the PR description.

## Security & Configuration Tips
- Start from `.env.example` for local development; keep secrets out of commits.
- Use seeded admin credentials for local testing (see `README.md` for defaults).
