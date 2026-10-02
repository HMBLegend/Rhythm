-- A user's training windows on the same day must not overlap, matching the
-- check in src/lib/scheduling/routine.ts. An exclusion constraint makes the
-- database refuse any row whose time range overlaps another of the user's
-- windows that day.

-- Lets the GiST index behind the constraint compare user_id and day_of_week
-- with "=" alongside the range overlap.
create extension if not exists btree_gist with schema extensions;

-- A range of times of day. Built as [start, end), so back-to-back windows
-- (18:00-19:00 and 19:00-20:00) touch without overlapping.
create type public.timerange as range (subtype = time);

alter table public.availability_window
  add constraint availability_window_no_overlap
    exclude using gist (
      user_id with =,
      day_of_week with =,
      public.timerange(start_time, end_time) with &&
    );
