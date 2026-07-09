create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('athlete', 'coach')),
  created_at timestamptz not null default now()
);

create table athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  coach_id uuid references users(id) on delete set null,
  sport text,
  position text,
  body_weight numeric,
  created_at timestamptz not null default now()
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  focus text,
  estimated_minutes integer,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  name text not null,
  details text,
  exercise_order integer not null default 0
);

create table workout_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  assigned_date date not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'complete')),
  created_at timestamptz not null default now(),
  unique (athlete_id, workout_id, assigned_date)
);

create table exercise_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references workout_assignments(id) on delete cascade,
  exercise_id uuid not null references workout_exercises(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (assignment_id, exercise_id)
);

create table habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table habit_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (athlete_id, habit_id)
);

create table habit_completions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  completion_date date not null,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  unique (athlete_id, habit_id, completion_date)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  name text not null,
  current_value numeric not null default 0,
  target_value numeric not null,
  unit text not null,
  status text not null default 'active' check (status in ('active', 'complete', 'paused')),
  created_at timestamptz not null default now()
);

create table progress_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  metric_name text not null,
  value numeric not null,
  unit text not null,
  recorded_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index athlete_profiles_user_id_idx on athlete_profiles(user_id);
create index athlete_profiles_coach_id_idx on athlete_profiles(coach_id);
create index workout_assignments_athlete_date_idx on workout_assignments(athlete_id, assigned_date);
create index habit_completions_athlete_date_idx on habit_completions(athlete_id, completion_date);
create index goals_athlete_status_idx on goals(athlete_id, status);
create index progress_entries_athlete_metric_date_idx on progress_entries(athlete_id, metric_name, recorded_date);
