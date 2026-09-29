-- Recurring weekly times a user can't train, e.g. "Mon 09:00-17:00 work".
-- The scheduling engine plans workouts around these.

create table public.busy_block (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  -- ISO weekday: 1 = Monday ... 7 = Sunday.
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  label text check (char_length(label) <= 50),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- Speeds up "all busy blocks for this user" and is used by every RLS check.
create index busy_block_user_id_idx on public.busy_block (user_id);

alter table public.busy_block enable row level security;

create policy "Users can read their own busy blocks"
  on public.busy_block for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own busy blocks"
  on public.busy_block for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own busy blocks"
  on public.busy_block for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own busy blocks"
  on public.busy_block for delete to authenticated
  using (user_id = (select auth.uid()));
