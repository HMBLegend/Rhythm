# Contributing

## Branching

`main` is the only long-lived branch. It always builds, passes CI and is what Vercel deploys to production.

Every change happens on a short-lived branch cut from an up-to-date `main`, and goes back in through a pull request. Never commit directly to `main`.

Branch names use a type prefix and a short kebab-case description:

| Prefix      | Use for                                  | Example                  |
| ----------- | ---------------------------------------- | ------------------------ |
| `feat/`     | New user-facing behaviour                | `feat/weekly-plan-view`  |
| `fix/`      | Bug fixes                                | `fix/sunday-off-by-one`  |
| `chore/`    | Tooling, config, dependencies            | `chore/upgrade-next`     |
| `docs/`     | Documentation and decision records only  | `docs/adr-auth-provider` |
| `refactor/` | Code changes with no behaviour change    | `refactor/engine-types`  |
| `phase-N/`  | Setup work that belongs to a whole phase | `phase-1/foundation`     |

Keep branches small and short-lived. Several focused PRs beat one large one.

## Commits

Write the subject in the imperative mood ("Add weekly plan view", not "Added…"), at most about 72 characters. Use the body to explain _why_ if it isn't obvious.

## Pull requests

1. Run `pnpm check` locally (lint, format, typecheck, tests).
2. Open the PR against `main` and fill in the template.
3. Link it to the phase milestone.
4. Wait for the checks to pass. Check the Vercel preview for UI changes.
5. Squash-merge. The branch is deleted automatically.
6. Locally: `git switch main && git pull --ff-only`, then `git branch -d <branch>`.

Never reuse a branch after it has been merged. Start a new one from `main`.

## Quality gates

`main` is protected by a GitHub ruleset. Changes must come through a pull request, the CI check must pass, only squash merges are allowed, and force pushes and branch deletion are blocked. No approval is required, since this is a solo project.

| When                | What runs                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------ |
| On commit (local)   | Pre-commit hook: ESLint `--fix` and Prettier on staged files (Husky + lint-staged)         |
| Every PR and `main` | **CI** (required): lint, format check, typecheck, tests, build                             |
| Every PR and `main` | **CodeQL**: security and code-quality scan of TypeScript and the GitHub Actions workflows  |
| Weekly              | **Dependabot**: grouped dependency and Actions update PRs; security fixes as soon as found |
| On push to GitHub   | **Secret scanning push protection**: blocks pushes that contain credentials                |

The hook is installed by `pnpm install`. It's a convenience, not the gate: CI is what blocks merging.

If a PR makes a significant product or architecture choice, add a record to [`docs/decisions/`](docs/decisions/).

## Working with Claude Code

Project instructions are in [`CLAUDE.md`](CLAUDE.md), and repeatable workflows are skills in [`.claude/skills/`](.claude/). The skills list is in [`.claude/README.md`](.claude/README.md). Keep it up to date.
