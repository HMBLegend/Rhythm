---
name: open-pr
description: Get finished work on a Rhythm branch merged-ready. Runs the checks, pushes the branch and opens a pull request against main using the repo template and phase milestone. Use when the user says the work is done, or asks to push or open a PR.
---

# Open a pull request

1. Confirm you're not on `main`. If you are, stop: the work should be moved to a branch first (see `start-work`).
2. Run `pnpm check`. Also run `pnpm build` if `src/app`, config or dependencies changed. If anything fails, fix it or report it. Don't open the PR with known failures unless the user says to.
3. Make sure everything is committed, with imperative-mood messages.
4. Check whether the change made a significant product or architecture decision. If so and there's no record yet, suggest the `decision-record` skill.
5. **Ask the user before pushing.** Then `git push -u origin <branch>`.
6. Open the PR with `gh pr create --base main`, filling in every section of `.github/pull_request_template.md`:
   - **What / Why:** from the commits and the phase goal.
   - **Decisions and trade-offs:** the real choices made, or "None".
   - **How it was verified:** tick only what was actually run and passed.
   - Add `--milestone "Phase N: ..."` if the milestone exists (`gh api repos/{owner}/{repo}/milestones`).
7. Give the user the PR URL, and say that CI and the Vercel preview will appear on it.

After merge: squash-merge, delete the branch, then `git switch main && git pull --ff-only`.
