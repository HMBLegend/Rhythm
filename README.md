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

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Start the dev server                          |
| `pnpm lint`       | ESLint, including the architecture boundaries |
| `pnpm typecheck`  | Generate route types and run `tsc`            |
| `pnpm test`       | Run Vitest once                               |
| `pnpm test:watch` | Run Vitest in watch mode                      |
| `pnpm format`     | Format with Prettier                          |
| `pnpm check`      | Everything CI runs, except the build          |
| `pnpm db:types`   | Regenerate TypeScript types from the database |

## Architecture

```
src/lib/scheduling/   pure TypeScript: no React, Next, Supabase or LLM imports
src/lib/llm/          server-only, the only place that talks to the LLM provider
src/lib/supabase/     browser and server Supabase clients, generated database types
src/lib/auth/         who may see which page (used by src/proxy.ts and the pages)
supabase/migrations/  SQL migrations: the database schema, one change per file
```

The scheduling engine decides every plan, and AI output never bypasses its validation. See [docs/decisions](docs/decisions/) for why.

## Database

The schema lives in `supabase/migrations/` and is applied to the hosted Supabase project with the Supabase CLI (a dev dependency). Every table has Row Level Security, so users can only reach their own rows. See [0003](docs/decisions/0003-database-schema.md).

```bash
pnpm exec supabase login                            # once per machine
pnpm exec supabase link --project-ref <project-ref> # once per clone
pnpm exec supabase migration new <name>             # write a migration
pnpm exec supabase db push                          # apply new migrations
pnpm db:types                                       # regenerate TypeScript types
```

Never edit a migration that has already been pushed. Add a new one.

## Workflow

`main` is the only long-lived branch. All changes go through short-lived branches and pull requests (see [CONTRIBUTING.md](CONTRIBUTING.md)). CI runs lint, format check, typecheck, tests and build on every PR, and Vercel deploys a preview for each one.
