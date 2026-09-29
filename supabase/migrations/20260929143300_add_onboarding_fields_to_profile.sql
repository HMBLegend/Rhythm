-- Onboarding answers that the scheduling engine needs, plus a marker for
-- "has finished onboarding". Allowed values match src/lib/scheduling/routine.ts.
-- experience has no default: the profile is only created by onboarding, which always sets it.

alter table public.profile
  add column experience text not null
    check (experience in ('beginner', 'intermediate', 'advanced')),
  -- An empty list means no equipment.
  add column equipment text[] not null default '{}'
    check (equipment <@ array[
      'dumbbells', 'kettlebells', 'barbell', 'resistance_bands',
      'pull_up_bar', 'bench', 'cardio_machine', 'gym_machines'
    ]::text[]),
  add column avoid text[] not null default '{}'
    check (avoid <@ array[
      'running', 'jumping', 'overhead', 'kneeling', 'floor_work', 'heavy_lifting'
    ]::text[]),
  add column avoid_note text check (char_length(avoid_note) <= 200),
  -- Set once onboarding is saved. Null means the user still has to onboard.
  add column onboarded_at timestamptz;
