# 0005: The database enforces the routine rules

- **Status:** Accepted
- **Date:** 2026-10-02

## Context

0004 validates onboarding answers with the Zod schemas in `src/lib/scheduling/routine.ts`, in the form and in `POST /api/onboarding`. But the browser holds the publishable key and the user's session, and RLS lets users write their own `profile`, `busy_block` and `availability_window` rows and call `complete_onboarding` directly. RLS keeps them to their own data, but they could store a routine the schema would reject: an unknown time zone, overlapping windows, no windows at all, or a profile without `onboarded_at`, which sent the app into a redirect loop. The Phase 4 engine plans from these rows.

## Decision

- **Keep direct writes under RLS, and make the database refuse what the schema refuses.** Phase 5 editing will need direct writes, so they stay.
- **New migrations add:**
  - `profile.onboarded_at` is `not null default now()`, so having a profile always means being onboarded.
  - Check constraints: `session_length_min` in 5-minute steps, and a `busy_block.label` can't be blank.
  - A trigger rejects a `profile.timezone` that isn't in `pg_timezone_names`.
  - An exclusion constraint (`btree_gist`, comparing times as a built-in `tsrange` on a fixed date) stops a user's windows overlapping on the same day. Back-to-back windows are still allowed.
  - `complete_onboarding` requires at least one window and no repeated day within a commitment, since those span several rows and a table constraint can't check them.
- **`POST /api/onboarding` answers 400** when the database rejects the answers (`23514`, `23P01`, `22023`), not 500.
- **A contract test** (`src/app/api/onboarding/complete-onboarding-sql.test.ts`) checks that the field names the SQL function reads match the schema.

## Trade-offs

- The rules now live in two places, Zod and SQL. A change must update both. The contract test only covers field names, not the rules themselves.
- Rules that span the whole routine, such as "at least one window", are only enforced on the onboarding path. A direct delete of every window is still possible, so the engine must still handle an empty or odd routine.
- The browser's `Intl` time zone list and Postgres's can differ slightly, e.g. a newly added zone. Such a user would get a 400 and couldn't onboard until the lists agree.
- Rejected: revoking direct writes so that every write goes through a `security definer` function. It's a stronger guarantee, but every future edit would need its own carefully written function that bypasses RLS.
