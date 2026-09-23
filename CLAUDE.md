@AGENTS.md

# Rhythm project rules

Mobile-first fitness planner. See `README.md` for the stack and `CONTRIBUTING.md` for the workflow.

## Git

- `main` is the only long-lived branch. Never commit or push directly to it.
- Start every piece of work on a new branch from an up-to-date `main` (skill: `start-work`).
- Merge only through a pull request with passing CI (skill: `open-pr`).
- Ask before pushing, opening PRs or changing GitHub settings.

## Architecture

- `src/lib/scheduling` is pure, deterministic TypeScript. No React, Next.js, Supabase or LLM imports (ESLint enforces this).
- `src/lib/llm` is server-only. LLM output is input to the engine and never bypasses its validation.
- Never give a secret a `NEXT_PUBLIC_` prefix. Only the Supabase URL and publishable key may use it.
- Free tiers only (`docs/decisions/0001-free-tier-only.md`).

## Before saying work is done

Run `pnpm check`, and `pnpm build` for anything touching `src/app`. Report failures as they are.

## Skills

Project skills live in `.claude/skills/<name>/SKILL.md` and are listed in `.claude/README.md`.

- When a workflow repeats, or the user corrects how something should be done, add or update a skill (skill: `update-skills`).
- Whenever a skill is added, changed or removed, update the list in `.claude/README.md` in the same commit.
