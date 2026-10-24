-- Staging-only correction: rccoach is the Rip City coach, not a shared Alpha
-- coach. Alpha retains its dedicated alphacoach fixture.

delete from public.facility_members
where id = '10000000-0000-4000-8000-000000000010'
  and profile_id = (
    select id from public.profiles where email = 'rccoach@example.com'
  )
  and facility_id = (
    select id from public.facilities where slug = 'test-facility-alpha'
  );
