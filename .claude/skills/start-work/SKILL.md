---
name: start-work
description: Start a new piece of work on Rhythm by creating a correctly named branch from an up-to-date main. Use before making any code or docs change, or when the user says "start", "new branch" or names a feature, fix or phase to work on.
---

# Start work

Every change goes on its own short-lived branch cut from `main`. Never edit on `main`.

1. Check `git status`. If there are uncommitted changes, stop and ask the user what to do with them. Don't stash or discard them without asking.
2. Update main: `git switch main && git pull --ff-only`.
3. Pick a name from the prefixes in `CONTRIBUTING.md` (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `phase-N/`) plus a short kebab-case description. If the type is unclear, propose a name and confirm it.
4. `git switch -c <branch>`.
5. Tell the user the branch name and which phase milestone it belongs to.

If the current branch already covers the same work and isn't merged, continue on it instead of creating a new one.
