---
name: update-skills
description: Add, change or remove a Rhythm project skill in .claude/skills and keep the list in .claude/README.md in sync. Use when a workflow has been repeated, the user corrects how something should be done, a skill is out of date, or the user asks to add or update a skill.
---

# Update skills

Skills record how this project does repeatable things, so they should change when the project does.

## When to add or change a skill

- The same multi-step workflow has come up a second time.
- The user corrects how something should be done. Update the skill that covers it, or create one.
- A skill references files, commands or tools that no longer exist.

Don't create a skill for a one-off task, or for something already covered by `CLAUDE.md`.

## Steps

1. **New skill:** create `.claude/skills/<kebab-name>/SKILL.md` with frontmatter:
   ```markdown
   ---
   name: <kebab-name>
   description: <what it does>. Use when <the situations that should trigger it>.
   ---
   ```
   The description decides when the skill is used, so name concrete triggers. Keep the body to short numbered steps.
2. **Changed skill:** edit it in place. Keep the steps accurate to how the project works now.
3. **Removed skill:** delete its folder.
4. **Always** update `.claude/README.md` in the same commit: the table row (with today's date in "Last updated") and a changelog line.
5. Tell the user what changed and why.
