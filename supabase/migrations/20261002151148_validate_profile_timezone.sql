-- profile.timezone must be a real IANA name (e.g. 'Europe/London'), or every
-- plan time would be read in the wrong zone. A check constraint shouldn't look
-- up other tables, so a trigger checks it against Postgres's time zone list.

create function public.validate_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'Unknown time zone: %', new.timezone
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_validate_timezone
  before insert or update of timezone on public.profile
  for each row execute function public.validate_profile_timezone();
