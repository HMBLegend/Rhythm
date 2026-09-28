-- One plan per user per week. Workouts belong to a plan.
-- Past weeks are kept, which gives us history.

create table public.week_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  -- Always the Monday the week starts on (ISO weekday 1).
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  -- A user can't have two plans for the same week.
  -- This also indexes user_id, since it's the first column.
  unique (user_id, week_start),
  -- Lets workout reference (id, user_id) together, so a workout
  -- can only belong to a plan owned by the same user.
  unique (id, user_id)
);

alter table public.week_plan enable row level security;

create policy "Users can read their own week plans"
  on public.week_plan for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own week plans"
  on public.week_plan for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own week plans"
  on public.week_plan for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own week plans"
  on public.week_plan for delete to authenticated
  using (user_id = (select auth.uid()));
