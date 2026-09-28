-- A "something came up" request: what the user said, the change the engine
-- proposed for one workout, why, and whether the user approved it.

create table public.replan_request (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  workout_id uuid not null,
  user_text text not null check (char_length(user_text) between 1 and 500),
  proposed_on date not null,
  proposed_start_time time not null,
  explanation text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- The workout must exist and belong to the same user.
  foreign key (workout_id, user_id)
    references public.workout (id, user_id) on delete cascade,
  -- Pending requests have no decision time; decided ones must have one.
  check ((status = 'pending') = (decided_at is null))
);

create index replan_request_workout_id_user_id_idx
  on public.replan_request (workout_id, user_id);
create index replan_request_user_id_idx on public.replan_request (user_id);

alter table public.replan_request enable row level security;

create policy "Users can read their own replan requests"
  on public.replan_request for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own replan requests"
  on public.replan_request for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own replan requests"
  on public.replan_request for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own replan requests"
  on public.replan_request for delete to authenticated
  using (user_id = (select auth.uid()));
