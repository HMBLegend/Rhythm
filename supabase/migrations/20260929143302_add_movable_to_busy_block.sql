-- Whether a commitment could be shifted if a workout needed the slot,
-- e.g. a gym class vs. a work shift. The engine treats fixed ones as hard limits.

alter table public.busy_block
  add column movable boolean not null default false;
