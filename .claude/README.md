# Claude Code setup

Project instructions are in [`../CLAUDE.md`](../CLAUDE.md). Repeatable workflows are **skills**, one folder each under [`skills/`](skills/). Claude Code loads them automatically. You can also run one directly by typing `/<name>`.

## Skills

Keep this table in sync with `skills/`. Update it in the same commit as any skill change.

| Skill                                                | Use it when                                                      | Last updated |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| [`start-work`](skills/start-work/SKILL.md)           | Starting any change: creates a correctly named branch off `main` | 2026-09-23   |
| [`open-pr`](skills/open-pr/SKILL.md)                 | Work is ready: checks, push, PR with template and milestone      | 2026-09-23   |
| [`decision-record`](skills/decision-record/SKILL.md) | A significant product or architecture choice was made            | 2026-09-23   |
| [`update-skills`](skills/update-skills/SKILL.md)     | Adding, changing or removing a skill                             | 2026-09-23   |

## Changelog

- 2026-09-23: Created `start-work`, `open-pr`, `decision-record` and `update-skills`.
