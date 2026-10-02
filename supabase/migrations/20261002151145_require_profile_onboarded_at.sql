-- A profile is only ever created by onboarding, so it always has an onboarding
-- time. Allowing null let a profile be inserted directly with no onboarded_at,
-- which the app read as "not onboarded" while complete_onboarding refused to run
-- again, sending the user round in a redirect loop.

alter table public.profile
  alter column onboarded_at set default now(),
  alter column onboarded_at set not null;
