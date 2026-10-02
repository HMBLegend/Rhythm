-- Saves a user's onboarding answers in one transaction: the profile, one
-- busy_block per commitment day and the availability windows. If any insert
-- fails, nothing is saved. The API validates the payload with
-- src/lib/scheduling/routine.ts first; the table constraints are a second check.
--
-- security invoker: the function runs as the calling user, so RLS applies to
-- every insert and it can only ever write the caller's own rows.
-- search_path = '': every name is schema-qualified, so a same-named object in
-- another schema can't be substituted.

create function public.complete_onboarding(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Onboarding happens once. Changing answers later is a separate feature.
  -- PT409 makes PostgREST answer with HTTP 409 Conflict.
  if exists (select 1 from public.profile where user_id = uid) then
    raise exception 'Already onboarded' using errcode = 'PT409';
  end if;

  insert into public.profile (
    user_id, goal, experience, sessions_per_week, session_length_min,
    equipment, avoid, avoid_note, timezone, onboarded_at
  )
  values (
    uid,
    payload ->> 'goal',
    payload ->> 'experience',
    (payload ->> 'sessionsPerWeek')::smallint,
    (payload ->> 'sessionLengthMin')::smallint,
    array(select jsonb_array_elements_text(payload -> 'equipment')),
    array(select jsonb_array_elements_text(payload -> 'avoid')),
    nullif(payload ->> 'avoidNote', ''),
    payload ->> 'timezone',
    now()
  );

  -- A commitment on several days becomes one row per day.
  insert into public.busy_block (
    user_id, day_of_week, start_time, end_time, label, movable
  )
  select
    uid,
    day::smallint,
    (commitment ->> 'start')::time,
    (commitment ->> 'end')::time,
    commitment ->> 'label',
    (commitment ->> 'movable')::boolean
  from jsonb_array_elements(payload -> 'commitments') as commitment,
    jsonb_array_elements_text(commitment -> 'days') as day;

  insert into public.availability_window (
    user_id, day_of_week, start_time, end_time
  )
  select
    uid,
    (window_ ->> 'day')::smallint,
    (window_ ->> 'start')::time,
    (window_ ->> 'end')::time
  from jsonb_array_elements(payload -> 'windows') as window_;
end;
$$;

-- New functions are executable by everyone by default. Only signed-in users need it.
revoke execute on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
