-- One profile per user: their goal and training preferences.
-- Created during onboarding (not on sign-up), because the goal isn't known yet.

create table public.profile (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  goal text not null
    check (goal in ('strength', 'endurance', 'general')),
  sessions_per_week smallint not null
    check (sessions_per_week between 1 and 7),
  session_length_min smallint not null
    check (session_length_min between 10 and 180),
  -- IANA name, e.g. 'Europe/London'. Plan times are local to this zone.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Row Level Security: each user can only see and change their own profile.
alter table public.profile enable row level security;

create policy "Users can read their own profile"
  on public.profile for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own profile"
  on public.profile for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profile for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own profile"
  on public.profile for delete to authenticated
  using (user_id = (select auth.uid()));
