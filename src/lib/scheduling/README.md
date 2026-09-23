# Scheduling engine

Pure TypeScript. This is the only code that decides what goes in a plan.

- No imports from React, Next.js, Supabase or `src/lib/llm`. ESLint enforces this (`eslint.config.mjs`).
- Deterministic: the same inputs always produce the same plan.
- LLM output is only ever an _input_ here, and it is validated like any other input.
