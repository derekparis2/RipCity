# Facility platform UI rehearsal — November 17, 2026

Fixes are deferred while findings are collected, at Derek's request.

## User-observed passes

- Created Launch Test (`launch-test-1117`).
- Reopened configuration and confirmed saved settings.
- First-admin signup reached pending approval for the intended facility.
- Approved the admin; login opened the new facility with its branding.
- Member signup/approval completed successfully.
- User reported all focused staging scripts passed after both hardening migrations.

## Collected findings and decisions

1. Login branding: RIP CITY heading appears black against a dark background.
2. Facility form inputs, label spacing, and checkbox alignment look unstyled.
   User reports the issue is not specific to dark mode.
3. Replace free-text time-zone entry with a readable dropdown.
4. Consider dedicated facility URLs (design decision, not settled).
5. Allow existing facility admins to invite additional admins in their own facility.
   Current approval is already allowed; admin invite creation is owner-only.
6. Logout from the new facility returns to Rip City's login and loses branding.
7. Consider a dedicated neutral Platform Login/URL. Alternative under discussion:
   one neutral login plus staff-issued, facility-specific registration links.
8. Rip City logos/colors flash while navigating before facility branding loads.
9. Facility pages should support more UI customization beyond logos and colors;
   exact customization scope is still to be decided.

## Agent checks

- Reran all 22 local test files: passed.
- Connected to deploy-preview-27 on the staging Netlify site.
- Read Launch Test's saved configuration: Chicago time zone, both member
  programs, all six modules, and distinct branding colors persisted.
- Verified the Member terminology input actually contains “Member”; the
  accessibility snapshot omitted the value, so it is not an empty-field bug.
- An already-open Launch Test Approvals page navigated to Rip City's roster.
  This is a context-switch observation requiring reproduction with a controlled
  account/session; it does not by itself prove a data-isolation failure.
- Returned to Platform via Exit Admin Mode. Directory loaded successfully.

## Next controlled tests

With explicit approval to enter support mode for the disposable Launch Test
facility: check its roster and group, create a QA workout, assign it, inspect
calendar/library behavior, then exit support. Member set-result persistence
requires access to the fake member's session. Avoid creating data until the
page confirms the correct facility after navigation.

## Controlled Launch Test admin run

Derek explicitly approved entering support mode and creating QA workouts and
assignments in the disposable Launch Test facility.

Verified through the staging UI:

- Enter Admin Mode opened Launch Test with one approved athlete.
- Navigation through Dashboard, Roster, Workout Builder, and Planner retained
  Launch Test. The roster showed only LT Athlete and Test group.
- Created `QA Launch Test – Weight Logging 1117`: one QA Goblet Squat exercise,
  two sets of eight reps, 15 minutes, assigned to Test group on 2026-11-17.
- The saved assignment appeared on the November calendar.
- Copying onto 2026-11-17 showed an occupied-date conflict and disabled Confirm Copy.
- Copying to 2026-11-24 succeeded; the calendar showed two occurrences.
- Workout Library showed one reusable workout, not the calendar-copy snapshot.
- Coach Dashboard review listed the original assignment and one not-started
  member, matching LT Athlete's group membership.
- Exit Admin Mode returned to Platform and the facility directory loaded
  successfully, after the exit RPC used by this page completed.

The QA workout and both assignments were intentionally retained for the member
logging test. No member results have been entered and no production data changed.

The earlier context-switch observation did not reproduce in this controlled
session. Keep it as a session-selection observation, not a proven isolation bug.
The Rip City branding flash on navigation did reproduce and remains finding #8.

Remaining handoff: sign into LT Athlete (`ltathlete@example.com`) on the same
staging preview. The agent can then test weight/reps saving and refresh
persistence without the user running those steps manually. Do not send the
password in chat. Full adversarial isolation, disabled-module combinations,
archived-invite rejection, and timed/session behavior remain outside this UI run.

## Member logging run — completed

Using Derek's signed-in LT Athlete staging session:

- Opened the November 17 QA workout from Training Calendar (initially 0/2 sets).
- Saved set 1 as weight 35, reps 8 with Save & Next.
- Saved set 2 as weight 40, reps 7 with Save Final Set.
- Reloaded the page from the server: 100%, 2/2 saved, Review Workout available.
- Reopened review and verified set 1 retained 35 x 8; saving it again and moving
  forward showed set 2 retained 40 x 7, with progress still 2/2.
- Member Training Calendar showed the original occurrence Complete, 2/2 sets.
- November 24's copied occurrence remained Scheduled, 0/2 sets. Results did not
  carry across occurrences. Did not save any results to this future occurrence.
- Direct member navigation to Coach Workouts redirected to Member Dashboard.
- Left the member signed in with the completed November 17 workout open.

Observation for product clarification (not yet classified as a defect): the
calendar calls a future workout link “Preview,” but its destination offers
Start Workout / Start Block controls. No future logging was attempted.

No code fixes were made. The previously noted branding flash reproduced on
member-page navigation. Coach-side review of these newly saved results still
needs a coach/admin session; the earlier coach review verified the assignment
before member results existed.


## Fix batch and feature availability — November 17

Implemented locally after Derek requested the collected fixes:

- Neutral shared login (including owner routing), facility-specific registration
  links, and a chooser for accounts with multiple approved memberships.
- Neutral Platform branding and no initial display of another facility's brand
  while verified configuration is loading. Fixed heading/logo fallback contrast.
- Styled responsive configuration forms and a named time-zone dropdown.
- Midnight, Slate, and Forest themes; shared page surfaces and readable accent
  buttons use the selected facility configuration.
- Generic Additional member program controls with editable singular/plural names,
  plus independent feature switches for both member programs. Existing Rip City
  names are preserved; teams/age groups remain separate Roster groups.
- Facility-wide module switches always override program-level switches.
- Added facility-admin creation of same-facility pending-admin invite links.
- Added guards against habit, workout-review, and announcement queries when their
  modules are disabled, plus gating for extensionless direct-page URLs.

Live testing used the deployed preview's existing global switches, not the
uncommitted new UI:

- All six modules off: module navigation and feature panels disappeared.
- Builder, Planner, Testing Days, and Leaderboards direct URLs redirected to
  Dashboard while disabled.
- Workouts only: Builder/Planner available, Testing Days absent.
- Testing Days only: Testing Days available, Builder absent.
- Restored all six switches and both program-enabled states to their original
  true values, reopened configuration to verify, and exited support mode.

Local automated verification: 23 test files pass, including 8,192 facility/
program feature combinations and actual member access gates for both member
programs on .html and extensionless routes. Fake-data browser previews verified
form layout at desktop/narrow widths, per-program controls disabling when the
facility feature is off, three different theme surfaces, and accent text contrast.

Derek reported successful staging application of
`20261117200000_add_facility_themes_and_program_features.sql`.
The expanded facility-configuration and admin-invite staging scripts must be
rerun against that schema. Preview deployment and member-session live checks of
the new per-program switches remain pending. No production migration was applied.


Derek reported that the expanded configuration and admin-invite staging checks
both passed after the appearance/program-feature migration. He chose to retain
early workout logging: future calendar actions now say Open Workout, and future
assignments show their actual In Progress/Complete state once results exist.
The remaining verification step is the newly deployed preview UI, especially
member navigation for each program's feature settings. Local changes have not
been committed or pushed by the agent.
