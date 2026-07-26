-- =====================================================
-- H2K BAND COLOR LEVELS V2
-- =====================================================
-- Proposed migration only. Do not run from Codex.
--
-- Purpose:
-- - Correct the allowed H2K band order/levels to:
--   No Band, White, Grey, Green, Blue, Black, Red.
-- - "No Band" is stored as null.

alter table public.member_profiles
  drop constraint if exists member_profiles_h2k_band_color_check;

alter table public.member_profiles
  add constraint member_profiles_h2k_band_color_check
  check (
    h2k_band_color is null
    or h2k_band_color in (
      'White',
      'Grey',
      'Green',
      'Blue',
      'Black',
      'Red'
    )
  );
