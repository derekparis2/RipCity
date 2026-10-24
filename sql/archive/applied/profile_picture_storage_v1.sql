-- ARCHIVED COMPONENT SOURCE: superseded by the verified initial migration.
-- =====================================================
-- Profile picture storage bucket and policies
-- =====================================================
-- Purpose:
-- Let approved/authenticated members upload their own profile picture files
-- into Supabase Storage. The public.profiles.profile_picture_url column stores
-- the resulting public URL.
--
-- Notes:
-- - Run this manually in the Supabase SQL Editor.
-- - This does not change public table structure.
-- - Files are stored under a folder named by auth.uid(), so members can only
--   write/delete their own images.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile pictures public read" on storage.objects;
create policy "profile pictures public read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'profile-pictures'
);

drop policy if exists "members upload own profile pictures" on storage.objects;
create policy "members upload own profile pictures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members update own profile pictures" on storage.objects;
create policy "members update own profile pictures"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members delete own profile pictures" on storage.objects;
create policy "members delete own profile pictures"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
