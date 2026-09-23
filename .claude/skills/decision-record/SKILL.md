---
name: decision-record
description: Write a short decision record in docs/decisions/ for a significant Rhythm product or architecture choice (context, decision, trade-offs). Use when a choice is made between real alternatives, a constraint is accepted, or the user asks to record or document a decision.
---

# Write a decision record

1. Find the next number: the highest `docs/decisions/NNNN-*.md` plus one, zero-padded to four digits.
2. Create `docs/decisions/NNNN-short-kebab-title.md`, following the format of the existing records:

   ```markdown
   # NNNN: Title

   - **Status:** Accepted
   - **Date:** YYYY-MM-DD

   ## Context

   The problem and constraints, in a few sentences.

   ## Decision

   What was chosen. Be concrete: name the files, rules or tools.

   ## Trade-offs

   What this costs and what was given up, including the alternatives rejected.
   ```

3. Add a row to the table in `docs/decisions/README.md`.
4. Never rewrite an accepted record. If a decision changes, write a new record and set the old one's status to `Superseded by NNNN`.
5. Keep it short, well under a page. It's for a reader skimming the repo.
