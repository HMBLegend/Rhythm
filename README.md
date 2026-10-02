# Rhythm

Mobile-first fitness planner that builds realistic weekly plans around your actual routine, and re-plans with an explanation and your approval when life gets in the way.

## Stack

Next.js (App Router), TypeScript (strict), Tailwind CSS, Supabase, Vercel. Tests with Vitest.

## Getting started

Requires Node 22 (see `.nvmrc`) and pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env.local   # then fill in your Supabase values
pnpm exec supabase login     # once per machine
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push   # create the tables in your Supabase project
pnpm dev
```

Open http://localhost:3000. The app needs the database schema to exist, so push the migrations before the first run (see [Database](#database)).

Sign-up uses Supabase Auth's email and password. With **Confirm email** on (a setting of the Email provider under Authentication in the Supabase dashboard), new users must click a link before they can log in, and the free tier only sends a few emails an hour. Turn it off while testing locally, and back on before real users.

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
src/app/              pages and API routes (see the route map below)
src/proxy.ts          runs before every page: refreshes the session, sends logged-out users to /login
src/lib/scheduling/   pure TypeScript: no React, Next, Supabase or LLM imports
src/lib/routine/      server-side loading of a user's saved routine, and its display labels
src/lib/llm/          server-only, the only place that talks to the LLM provider
src/lib/supabase/     browser and server Supabase clients, generated database types
src/lib/auth/         who may see which page (used by src/proxy.ts and the pages)
supabase/migrations/  SQL migrations: the database schema, one change per file
```

| Route             | What it is                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `/`               | Landing page                                                      |
| `/login`          | Email and password sign-in and sign-up                            |
| `/onboarding`     | Multi-step form describing the user's week (until it's completed) |
| `/week`           | Home for onboarded users; the weekly plan arrives in Phase 4      |
| `/api/onboarding` | `POST`: validates and saves the onboarding answers                |

The scheduling engine decides every plan, and AI output never bypasses its validation. See [docs/decisions](docs/decisions/) for why.

## Onboarding

A new user signs up, answers five short screens (goal and experience, how much they can train, fixed commitments, times they could train, equipment and limits), checks a review screen and confirms. Each screen is validated with the shared schemas in `src/lib/scheduling/routine.ts`.

- **Saved all or nothing.** `POST /api/onboarding` checks the session, validates again, and calls the `complete_onboarding` database function, which writes the profile, busy blocks and training windows in one transaction.
- **Nothing is saved until confirm.** Refreshing mid-way starts over.
- **Once only.** A second save is refused. Logged-out users are sent to `/login`, users who haven't onboarded to `/onboarding`, and onboarded users to `/week`.
- **Checked on the way back out too.** The database repeats the rules, and stored routines are read through `parseStoredRoutine`, because the browser can also write the tables directly.

See [0004](docs/decisions/0004-onboarding.md) and [0005](docs/decisions/0005-database-enforces-routine-rules.md).

## Database

The schema lives in `supabase/migrations/` and is applied to the hosted Supabase project with the Supabase CLI (a dev dependency). Every table has Row Level Security, so users can only reach their own rows.

| Table                 | Holds                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| `profile`             | One per user: goal, experience, sessions, equipment, limits, time zone |
| `busy_block`          | Recurring times the user can't train, one row per day                  |
| `availability_window` | Recurring times the user could train                                   |
| `week_plan`           | One plan per user per week                                             |
| `workout`             | A planned workout inside a week plan                                   |
| `replan_request`      | A "something came up" request and the proposed change                  |

The design and ownership rules are in [0003](docs/decisions/0003-database-schema.md), with onboarding's additions in [0004](docs/decisions/0004-onboarding.md) and the data rules the database enforces in [0005](docs/decisions/0005-database-enforces-routine-rules.md).

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
