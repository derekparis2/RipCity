-- Preserve the staff display name on each announcement. Members are not given
-- broad read access to staff profiles just to render attribution.

alter table public.coach_announcements
  add column if not exists author_display_name text;

update public.coach_announcements announcement
set author_display_name = coalesce(nullif(trim(profile.full_name), ''), 'Coach')
from public.profiles profile
where profile.id = announcement.created_by
  and announcement.author_display_name is null;

create or replace function app_private.set_announcement_author_display_name()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  select coalesce(nullif(trim(profile.full_name), ''), 'Coach')
  into new.author_display_name
  from public.profiles profile
  where profile.id = new.created_by;

  new.author_display_name := coalesce(new.author_display_name, 'Coach');
  return new;
end;
$$;

drop trigger if exists set_announcement_author_display_name on public.coach_announcements;
create trigger set_announcement_author_display_name
before insert or update of created_by on public.coach_announcements
for each row execute function app_private.set_announcement_author_display_name();

alter table public.coach_announcements
  alter column author_display_name set not null;

