# 0003: Database schema and ownership rules

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Rhythm needs to store each user's preferences, recurring busy times, weekly plans, workouts and re-plan requests. The browser talks to Supabase directly with the publishable key, so the database itself has to stop users reading or changing each other's data. The schema was designed from four screens: onboarding, this week, workout detail and "something came up".

## Decision

- **Five tables** in `public`, created by migrations in `supabase/migrations/`, one table per migration: `profile`, `busy_block`, `week_plan`, `workout`, `replan_request`.
- **Every row has a `user_id`**, defaulting to `auth.uid()`, that cascades on account deletion. `profile` uses it as its primary key (one per user). The other tables have their own `id`.
- **Row Level Security is on for every table**, with one policy per action: `user_id = (select auth.uid())`, `to authenticated`. Logged-out visitors get nothing.
- **Composite foreign keys** (`workout (week_plan_id, user_id) → week_plan (id, user_id)`, and the same from `replan_request` to `workout`) make the database check that a child row has the same owner as its parent. RLS alone only checks the row being written.
- **Allowed values are `text` with `check` constraints**, not Postgres enums, because they're simpler to change in a later migration.
- **The database guards shape and ownership. The scheduling engine guards scheduling rules** (e.g. a workout falls inside its week and avoids busy blocks), in line with 0002.
- **The profile is created during onboarding**, not by a sign-up trigger, because the goal isn't known at sign-up.
- **No exercise tables yet.** They can be added later as `exercise` and `workout_exercise` without changing these five.
- **Migrations are applied straight to the hosted project** with `supabase db push`. There is no local Docker stack while there are no real users.

## Trade-offs

- The extra `unique (id, user_id)` constraints and composite keys add some complexity in exchange for ownership the database enforces, not just app code.
- Check-constrained `text` shows up as `string` in the generated types, not a union. The app narrows it where needed.
- Pushing straight to the hosted project skips a local test database. Once real users exist, switch to `supabase start` locally or a second project before pushing.
- Overnight busy times must be split into two blocks, because `end_time > start_time`.
