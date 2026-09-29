---
name: db-migration
description: Add or change Rhythm's database schema with a Supabase migration, push it to the hosted project, regenerate types and commit. Use when a table, column, constraint, index or RLS policy needs to be added or changed.
---

# Database migration

Schema changes only ever happen through migration files in `supabase/migrations/`, never by editing tables in the Supabase dashboard. See `docs/decisions/0003-database-schema.md` for the conventions.

1. Be on a feature branch (see `start-work`). The CLI must be linked: `supabase/.temp/project-ref` exists. If it isn't, ask the user to run `! pnpm exec supabase login` and `! pnpm exec supabase link --project-ref <ref>`.
2. `pnpm exec supabase migration new <snake_case_name> < /dev/null` (the redirect stops the CLI hanging on stdin). One focused change per migration.
3. Write the SQL. For a new table, follow the existing migrations:
   - `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`
   - `enable row level security` and four policies (select, insert, update, delete) `to authenticated` using `user_id = (select auth.uid())`
   - a composite foreign key `(parent_id, user_id) → parent (id, user_id)` for child tables, and `unique (id, user_id)` on any table that children reference
   - an index on every foreign key
   - `text` plus `check (… in (…))` for allowed values, not enums
4. **Never edit a migration that has already been pushed.** Write a new one.
5. Show the user the SQL and explain it before pushing. Then `pnpm exec supabase db push --dry-run < /dev/null`, check that it lists only the expected files, and `pnpm exec supabase db push --yes < /dev/null`.
6. Verify with the Supabase MCP: `list_tables` (RLS enabled), `get_advisors` for security (must be empty) and performance (`unused_index` on new, empty tables is expected).
7. For RLS or constraint changes, test in an `execute_sql` `do` block: act as two users with `set_config('role', 'authenticated', true)` and `set_config('request.jwt.claims', …)`, check what each can see and change, and end with `raise exception` so everything rolls back.
8. `pnpm db:types` to regenerate `src/lib/supabase/database.types.ts`, then `pnpm typecheck`.
9. Commit the migration, together with the regenerated types if they changed.
