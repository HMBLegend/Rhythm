-- One planned workout inside a week plan, e.g. "Fri 07:00, lower body, 45 min".

create table public.workout (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  week_plan_id uuid not null,
  scheduled_on date not null,
  start_time time not null,
  duration_min smallint not null check (duration_min between 1 and 300),
  type text not null
    check (type in ('upper', 'lower', 'full_body', 'cardio', 'mobility')),
  status text not null default 'planned'
    check (status in ('planned', 'done', 'skipped', 'moved')),
  created_at timestamptz not null default now(),
  -- Composite foreign key: the plan must exist AND belong to the same user.
  -- A plain week_plan_id reference would let a user attach a workout to
  -- someone else's plan, because RLS only checks this row's user_id.
  foreign key (week_plan_id, user_id)
    references public.week_plan (id, user_id) on delete cascade,
  -- Lets replan_request reference (id, user_id) together, for the same reason.
  unique (id, user_id)
);

-- Speeds up "all workouts in this plan" and the foreign key check.
create index workout_week_plan_id_user_id_idx
  on public.workout (week_plan_id, user_id);
-- Speeds up "all workouts for this user" and every RLS check.
create index workout_user_id_idx on public.workout (user_id);

alter table public.workout enable row level security;

create policy "Users can read their own workouts"
  on public.workout for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own workouts"
  on public.workout for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own workouts"
  on public.workout for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own workouts"
  on public.workout for delete to authenticated
  using (user_id = (select auth.uid()));
