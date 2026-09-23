# 0002: Deterministic scheduling engine, LLM as parser

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

Rhythm builds weekly plans and re-plans when the user's week changes. An LLM is good at understanding messy input ("I've got a late meeting Thursday") but can't be trusted to produce plans that respect hard constraints such as rest days, time windows and session limits. It can also be unavailable because of rate limits.

## Decision

- The **scheduling engine** (`src/lib/scheduling`) is pure, deterministic TypeScript. It alone produces plans and validates every change.
- The **LLM** (`src/lib/llm`) only turns free text into structured input for the engine. Its output is validated like any other input, and the user approves changes before they apply.
- The engine cannot import LLM, database or framework code. This is enforced by an ESLint rule, not just convention.
- The LLM module imports `server-only`, and its key never uses a `NEXT_PUBLIC_` prefix, so it can't reach the browser.

## Trade-offs

- More code than letting the LLM write plans directly, since every rule is implemented and tested by hand.
- In return, plans are testable and explainable, and the app works with no AI at all.
