# Rip City Beta Launch Plan

Use this before inviting Rip City testers.

## Goal

Get coaches, H2K members, and athletes using the core app without unfinished
features getting in the way.

## Must Work Before Testing

- Coaches can log in and access only coach/admin pages.
- Members can sign up, wait for approval, and log in after approval.
- Coaches can approve members.
- Coaches can assign members to groups.
- Coaches can set H2K band color.
- Coaches can create workouts from the exercise library.
- Coaches can assign workouts to one group, multiple groups, a member, or the facility.
- Members can see today's workout when assigned by member, group, or facility.
- Members can save one set and save all sets.
- Saved workout logs reload after refresh.
- Members can open past workouts and future workouts.
- H2K members can log habits and see daily/weekly scores.
- Athletes do not see H2K habits.
- Members can upload a profile picture.
- Feedback form links open from member and coach pages.

## Beta Setup Steps

1. Apply only approved, staging-tested migrations from `supabase/migrations/`
   using the database release checklist.
2. Confirm Row Level Security is enabled for all app tables.
3. Confirm the `profile-pictures` storage bucket exists and has its policies.
4. Create or confirm one coach/admin account.
5. Create one H2K member and one athlete account.
6. Approve both member accounts from the coach approval page.
7. Add each member to the right group from the roster page.
8. Create one H2K workout and one athlete workout.
9. Assign one workout for today and one future workout.
10. Test on desktop and phone-sized screens.

## First Tester Script

Ask each tester to do these actions on the device they normally use:

1. Log in.
2. Open the dashboard.
3. Upload or update their profile picture.
4. Open today's workout if assigned.
5. Save one set.
6. Save all sets.
7. Refresh and confirm the results stayed saved.
8. Open Future Workouts.
9. Open Past Workouts.
10. Send one feedback form response.

## What To Watch

- Confusing words or labels.
- Buttons that do not look clickable.
- Anything that does not save after refresh.
- Workout builder steps that take too long.
- Phone layouts that feel too big, cramped, or hard to tap.
- Members seeing modules they should not see.
- Coaches seeing members or data outside their facility.

## Keep Out Of Beta For Now

- Parent access.
- Payments.
- Public leaderboards.
- AI summaries.
- Calculated maxes and PR claims.
- Cross-facility support mode.
