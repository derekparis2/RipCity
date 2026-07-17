-- =====================================================
-- RIP CITY PROFILE GENDER OPTIONS V2
-- =====================================================
-- Non-destructive follow-up to profile_gender_v1.sql.
-- Removes "nonbinary" from the allowed Gender dropdown values.

update public.member_profiles
set gender = null
where gender = 'nonbinary';

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (
    gender is null
    or gender in ('female', 'male', 'other')
  );
