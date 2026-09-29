---
name: dependabot-pr
description: Review and merge a Dependabot pull request on Rhythm, checking major bumps for breaking changes and keeping Node types matched to the runtime. Use when a Dependabot PR is open, or the user asks to handle, review or merge dependency or GitHub Actions updates.
---

# Handle a Dependabot PR

Dependabot opens weekly PRs (config: `.github/dependabot.yml`): one grouped `chore(deps)` PR for npm minor and patch updates, one PR per npm major, and one grouped `chore(ci)` PR for GitHub Actions.

1. List them: `gh pr list --author app/dependabot`. Handle one at a time, oldest first, because merging one often makes the next need a rebase.
2. Read the PR (`gh pr view <n>`) and sort it:
   - **Minor/patch group or Actions group:** low risk. Go to step 4.
   - **Major bump:** read the release notes linked in the PR body for breaking changes, and `grep` the repo for any API they mention. For `next`, also read the upgrade guide in `node_modules/next/dist/docs/` after checking out the branch.
3. **`@types/node` major:** don't merge. Types must match the runtime in `.nvmrc` and `engines` in `package.json`, so they're bumped together by hand on a normal branch. Close the PR with a comment saying so.
4. Wait for checks: `gh pr checks <n> --watch`. CI already runs lint, format, typecheck, test and build. CodeQL alerts block the merge.
5. If a check fails, check out the branch (`gh pr checkout <n>`), run `pnpm install` and `pnpm check`, and find the cause. Fix it with a commit on the Dependabot branch, or close the PR and do the upgrade on a `chore/` branch (see `start-work`) if it needs real code changes. Tell the user which.
6. For Actions updates, check every `uses:` is still a full commit SHA with a version comment.
7. **Ask the user before merging.** Then `gh pr merge <n> --squash`.
8. If another Dependabot PR now conflicts, comment `@dependabot rebase` on it and wait for the checks again. If one was superseded (a newer PR covers the same packages), Dependabot closes it itself.
9. Locally: `git switch main && git pull --ff-only`, then `pnpm install` so `node_modules` matches the new lockfile.
