# Hard to Kill Starter Website

A basic front-end prototype for the Hard to Kill athlete development platform.

## Current features

- Athlete dashboard
- Today's workout
- Exercise completion tracking
- Daily habits
- Habit completion tracking
- Daily streak placeholder
- Progress page
- Personal goals page
- Browser storage using `localStorage`

## How to run it in VS Code

1. Open the `hard-to-kill-starter` folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html`.
4. Select **Open with Live Server**.

You can also open `index.html` directly in a browser, but Live Server is easier while editing.

## Files

- `index.html` — website structure
- `styles.css` — all styling
- `app.js` — workouts, habits, goals, navigation, and browser storage

## Important limitation

This version does not have real user accounts or a database yet. It saves completed workouts and habits only in the user's browser.

## Database planning

- `DATABASE_PLAN.md` explains the next phase of the project and the data the app should track.
- `supabase_schema.sql` is a starter PostgreSQL schema that can be used in Supabase.
- `SUPABASE_SETUP.md` explains how to create a Supabase project and connect this app to it.

## Recommended next steps

1. Build the login and registration screens.
2. Add a coach dashboard.
3. Create forms for workouts, habits, and goals.
4. Add a backend using Node.js and Express.
5. Connect PostgreSQL or Supabase.
6. Store athletes, coaches, workouts, habits, completions, goals, and streaks in the database.
