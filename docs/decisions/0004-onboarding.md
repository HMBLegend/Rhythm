# 0004: Onboarding flow and how it's saved

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

A new user describes their week once, and the Phase 4 scheduler plans from it. The answers must be validated the same way everywhere they can come from (the form, the API, and later AI-proposed changes), saved all or nothing, and only ever under the logged-in user. Supabase JS can't run a multi-statement transaction.

## Decision

- **Ask only what the scheduler needs:** goal, experience, sessions per week and length, fixed commitments (with a "could move" flag), training windows, equipment, and things to avoid as fixed tags plus a short note. Body metrics and injury detail are left for later.
- **One shared schema.** `src/lib/scheduling/routine.ts` holds the Zod schemas, one per screen plus the whole routine. It lives inside the engine boundary so Phase 4 and 6 use exactly these rules, and it has no server imports so the browser can use it too. The schema is strict, so a body `user_id` is rejected.
- **Saved by one database function.** `POST /api/onboarding` verifies the session with `getUser()`, validates, then calls `public.complete_onboarding(payload)`. A function call is one transaction. It is `security invoker`, so RLS still applies and it can only write the caller's rows, and the owner comes from `auth.uid()`.
- **Onboarding happens once.** `profile.onboarded_at` marks it done, and the function refuses a second run (409). Editing answers later will be a separate feature.
- **Commitments are stored one row per day** in `busy_block`, the shape the engine reads. Availability windows get their own table.
- **Answers stay in the browser until the final confirm.** There is no draft saving.
- **Redirects:** `src/proxy.ts` refreshes the session and sends logged-out users to `/login` using the cookie only. Each page checks again on the server, including whether the user has onboarded. Both use one tested function, `src/lib/auth/routing.ts`.
- **Login is minimal email and password**, so testing doesn't depend on the free tier's email limit.

## Trade-offs

- Refreshing mid-onboarding loses the answers. The form is short, and saving drafts would need more tables or storage.
- Grouping a multi-day commitment into rows loses the grouping, so a future edit screen shows each day separately.
- The SQL function repeats the field names from the schema. The table constraints catch drift, but a rename must change both.
- Asking little upfront means the first plans may be generic. The re-plan flow is meant to learn the rest.
