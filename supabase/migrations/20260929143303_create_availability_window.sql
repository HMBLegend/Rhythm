-- Recurring weekly times a user could train, e.g. "Tue 18:00-20:00".
-- The opposite of busy_block: the engine places workouts inside these.

create table public.availability_window (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  -- ISO weekday: 1 = Monday ... 7 = Sunday.
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- Speeds up "all windows for this user" and is used by every RLS check.
create index availability_window_user_id_idx
  on public.availability_window (user_id);

alter table public.availability_window enable row level security;

create policy "Users can read their own availability windows"
  on public.availability_window for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own availability windows"
  on public.availability_window for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own availability windows"
  on public.availability_window for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own availability windows"
  on public.availability_window for delete to authenticated
  using (user_id = (select auth.uid()));
