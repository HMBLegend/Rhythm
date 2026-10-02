-- The custom public.timerange type added constructor functions to the public
-- schema, which the Data API exposes and the security advisor flags (no fixed
-- search_path). The built-in tsrange does the same job: each time is placed on
-- one arbitrary fixed date, so only the time of day is compared. Still [start, end),
-- so back-to-back windows touch without overlapping.

alter table public.availability_window
  drop constraint availability_window_no_overlap;

drop type public.timerange;

alter table public.availability_window
  add constraint availability_window_no_overlap
    exclude using gist (
      user_id with =,
      day_of_week with =,
      tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time)
        with &&
    );
