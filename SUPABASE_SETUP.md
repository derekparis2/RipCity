# Supabase Connection Setup

Use this when you are ready to connect the current Hard to Kill prototype to a real database.

## 1. Create the Supabase Project

1. Go to <https://supabase.com>.
2. Create a new project.
3. Save the project password somewhere safe.
4. Wait for the project to finish setting up.

## 2. Create the Database Tables

1. Open the Supabase project dashboard.
2. Go to the SQL Editor.
3. Open this project file: `supabase_schema.sql`.
4. Copy the full SQL file into the Supabase SQL Editor.
5. Run it.

This creates the tables for users, athlete profiles, workouts, exercises, habits, goals, and progress entries.

## 3. Get the Project Connection Values

In Supabase, go to:

`Project Settings` -> `API`

Copy these values:

- Project URL
- Publishable key, also called the anon/public key

Do not put the service role key in frontend JavaScript. The service role key is private and should only be used on a secure backend.

## 4. Add the Supabase Browser Script

In `index.html`, add this above `app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
<script src="app.js"></script>
```

Then replace the current bottom script tag:

```html
<script src="app.js"></script>
```

with the three script tags above.

## 5. Create `supabase-config.js`

Create a file named `supabase-config.js`:

```js
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
```

This gives `app.js` access to the database through `db`.

## 6. Insert Starter Data

Before the app can load data, the database needs a test athlete, a workout, exercises, habits, and goals.

The easiest first version is to manually add data in Supabase's Table Editor. Later, create real forms in the app.

Recommended starter records:

- One coach user
- One athlete user
- One athlete profile
- One workout named `Lower Body Power`
- Five workout exercises
- Five habits
- Three goals

## 7. Connect One Feature First

Do not connect everything at once. Start with habit completion.

The current app stores habits here:

```js
const habits = [
  { name: "Drink 100 oz of water", category: "Hydration", complete: false },
  ...
];
```

The database version should eventually load habits from Supabase:

```js
async function loadHabitsFromDatabase(athleteId) {
  const { data, error } = await db
    .from("habit_assignments")
    .select("habit_id, habits(name, category)")
    .eq("athlete_id", athleteId)
    .eq("active", true);

  if (error) {
    console.error(error);
    return;
  }

  habits.length = 0;

  data.forEach(item => {
    habits.push({
      id: item.habit_id,
      name: item.habits.name,
      category: item.habits.category,
      complete: false
    });
  });
}
```

Then habit checks should save into `habit_completions`.

## 8. What Still Needs to Be Built

The app needs these upgrades to become a real platform:

1. Login and signup
2. Real athlete accounts
3. Real coach accounts
4. Database-loaded workouts
5. Database-saved exercise completions
6. Database-saved habit completions
7. Add Goal form
8. Progress entry form
9. Coach dashboard
10. Row Level Security policies in Supabase

## 9. Best Next Milestone

The best next milestone is:

> Save daily habit completion to Supabase.

That proves the app can write real training data to a database. After that, connect workout completion, goals, and coach views.
