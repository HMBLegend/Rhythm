-- Same as before, plus two payload checks that no table constraint can make,
-- because they span several rows: at least one training window, and no day
-- repeated within one commitment (it would become two identical busy blocks).
-- The function can be called directly with the browser's key, so it mustn't
-- rely on the API having validated the payload first.

create or replace function public.complete_onboarding(payload jsonb)
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

  -- The case keeps jsonb_array_length from seeing a non-array, which would error.
  if coalesce(jsonb_array_length(case
      when jsonb_typeof(payload -> 'windows') = 'array' then payload -> 'windows'
    end), 0) = 0 then
    raise exception 'At least one training window is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payload -> 'commitments') as commitment
    where (select count(*) from jsonb_array_elements_text(commitment -> 'days'))
      <> (select count(distinct day) from jsonb_array_elements_text(commitment -> 'days') as day)
  ) then
    raise exception 'A commitment repeats a day'
      using errcode = 'invalid_parameter_value';
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
