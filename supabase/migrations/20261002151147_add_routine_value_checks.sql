-- Rules from src/lib/scheduling/routine.ts that the tables didn't enforce yet.
-- The browser can write these tables directly (RLS limits it to the user's own
-- rows), so the database has to hold the same line as the API.

alter table public.profile
  -- The form offers 5-minute steps and the schema requires them.
  add constraint profile_session_length_min_step
    check (session_length_min % 5 = 0);

alter table public.busy_block
  -- A label is optional, but if present it can't be only spaces.
  add constraint busy_block_label_not_blank
    check (label is null or char_length(btrim(label)) > 0);
