# Rhythm

Mobile-first fitness planner that builds realistic weekly plans around your actual routine, and re-plans with an explanation and your approval when life gets in the way.

## Stack

Next.js (App Router), TypeScript (strict), Tailwind CSS, Supabase, Vercel. Tests with Vitest.

## Getting started

Requires Node 22 (see `.nvmrc`) and pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env.local   # then fill in your Supabase values
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Start the dev server                          |
| `pnpm lint`      | ESLint, including the architecture boundaries |
| `pnpm typecheck` | Generate route types and run `tsc`            |
| `pnpm test`      | Run Vitest once                               |
| `pnpm format`    | Format with Prettier                          |
| `pnpm check`     | Everything CI runs, except the build          |

## Architecture

```
src/lib/scheduling/   pure TypeScript: no React, Next, Supabase or LLM imports
src/lib/llm/          server-only, the only place that talks to the LLM provider
src/lib/supabase/     browser and server Supabase clients
```

The scheduling engine decides every plan, and AI output never bypasses its validation. See [docs/decisions](docs/decisions/) for why.

## Workflow

`main` is the only long-lived branch. All changes go through short-lived branches and pull requests (see [CONTRIBUTING.md](CONTRIBUTING.md)). CI runs lint, format check, typecheck, tests and build on every PR, and Vercel deploys a preview for each one.
