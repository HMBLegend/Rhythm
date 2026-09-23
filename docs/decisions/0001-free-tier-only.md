# 0001: Free-tier-only infrastructure

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

Rhythm is a portfolio project with no budget. It should cost nothing to run and stay deployable by anyone who clones it.

## Decision

Use only free tiers: Vercel Hobby for hosting, Supabase Free for the database and auth, and a free LLM tier (Groq or Gemini) for parsing.

## Trade-offs

- **Supabase Free pauses inactive projects** after about a week. The app can look broken after a quiet spell, so resume the project before a demo.
- **Vercel Hobby is for non-commercial use only.** Fine for a portfolio. If Rhythm is ever monetised, hosting has to move to a paid plan.
- **Free LLM tiers are rate-limited.** The app must therefore work fully with no AI at all (Phase 5 milestone), with AI as an enhancement.
