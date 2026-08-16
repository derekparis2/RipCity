# Rip City Deployment Prep

Use this checklist before putting Rip City on a live URL for testers.

## Hosting Choice

Rip City is currently a static frontend that talks directly to Supabase with the
publishable anon key. It can be hosted by any static host that serves HTML, CSS,
JavaScript, and image assets.

Good beta options:

- Netlify
- Vercel
- GitHub Pages
- Supabase hosting through another static host

## Supabase Auth Settings

Before inviting testers:

1. Add the live site URL to Supabase Auth allowed redirect URLs.
2. Add local development URLs if you still test locally:
   - `http://localhost:8000`
   - `http://127.0.0.1:8000`
3. Confirm email confirmation behavior.
4. If email confirmation is enabled, retest signup because app profile rows may
   need a server-side signup handler later.

## Supabase Database Settings

Confirm these migrations/features are present in the live project:

- Approved migrations from `supabase/migrations/` and required Rip City
  configuration.
- Profile fields.
- Username login support.
- Signup group selection support.
- H2K band color support with the corrected band levels.
- Exercise library tables, policies, and seed exercises.
- Profile picture storage bucket and policies.
- RLS policies enabled on every public app table.

## Storage Settings

Confirm the `profile-pictures` bucket exists.

Profile pictures should:

- Allow public read access for uploaded profile images.
- Allow authenticated users to upload only into their own user folder.
- Allow authenticated users to update/delete only their own uploaded images.
- Reject files larger than the configured 5 MB app limit.

## Final Manual Checks

Run these on the deployed URL, not only localhost:

1. Coach login.
2. H2K member login.
3. Athlete login.
4. New signup and pending approval.
5. Coach approval.
6. Workout builder create and assign.
7. Member dashboard workout visibility.
8. Workout session Save Set and Save All Sets.
9. Profile picture upload.
10. Feedback form links from member and coach pages.

## Do Not Ship Yet If

- Any logged-out user can see member data.
- A pending member can access the dashboard.
- A member can see another member's private logs/profile data.
- A coach can see or manage another facility's data.
- Signup creates an auth user but no app profile/membership rows.
- Profile picture upload fails on the deployed URL.
