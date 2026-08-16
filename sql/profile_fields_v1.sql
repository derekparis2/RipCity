-- =====================================================
-- Profile fields used by the current Rip City profile UI
-- =====================================================
-- Purpose:
-- Keep clean database rebuilds aligned with the application.
--
-- Notes:
-- - This migration is non-destructive.
-- - The current live Supabase project appears to already have these columns.
-- - Do not run this automatically; apply it manually in Supabase only when
--   bringing a database up to the current app shape.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists birthday date,
  add column if not exists profile_picture_url text;

alter table public.member_profiles
  add column if not exists height text,
  add column if not exists training_focus text,
  add column if not exists favorite_lift text;

-- The canonical case-insensitive username index is created by
-- username_login_v1.sql. Keeping it there avoids two equivalent indexes in a
-- fresh database rebuild.
