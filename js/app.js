// =====================================================
// LEGACY MAIN APP PROTOTYPE
// =====================================================
// index.html is still useful as visual/design reference, but most live member
// workflows now happen in member-dashboard.html, coach-workouts.html, and
// workout-session.html with Supabase data. This file still uses localStorage
// for mock dashboard sections.

// =====================================================
// AUTH / ACCESS PROTECTION
// =====================================================
// This makes sure only approved users can access the main app.
// Pending users get sent to pending.html.
// Logged-out users get sent to login.html.
// Coaches/admins can still access the app, but later they will get a coach dashboard.

async function protectAppPage() {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    window.location.href = "login.html";
    return null;
  }

  const session = sessionData.session;

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      global_role,
      facility_members:facility_members!facility_members_profile_id_fkey (
        id,
        role,
        status,
        facility_id
      )
    `)
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    console.error("Profile error:", profileError);
    window.location.href = "login.html";
    return null;
  }

  const membership = profile.facility_members?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  return {
    session,
    profile,
    membership
  };
}

const exercises = [
  { name: "Box Jump", details: "4 sets × 3 reps", complete: false },
  { name: "Trap Bar Deadlift", details: "4 sets × 5 reps", complete: false },
  { name: "Bulgarian Split Squat", details: "3 sets × 8 reps each side", complete: false },
  { name: "Nordic Hamstring Curl", details: "3 sets × 6 reps", complete: false },
  { name: "Sled Push", details: "5 rounds × 20 yards", complete: false }
];

const habits = [
  { name: "Drink 100 oz of water", category: "Hydration", complete: false },
  { name: "Eat protein with every meal", category: "Nutrition", complete: false },
  { name: "Complete 10 minutes of mobility", category: "Recovery", complete: false },
  { name: "Sleep at least 8 hours", category: "Sleep", complete: false },
  { name: "Review tomorrow's plan", category: "Preparation", complete: false }
];

let goals = [
  { name: "Trap Bar Deadlift", current: 365, target: 405, unit: "lb" },
  { name: "Body Weight", current: 184, target: 190, unit: "lb" },
  { name: "Workout Consistency", current: 24, target: 28, unit: "days" }
];

const athletes = [
  {
    name: "Derek Paris",
    group: "College",
    workout: "Complete",
    habits: "5/5",
    streak: 6,
    score: 96,
    status: "On Track"
  },
  {
    name: "Mike Johnson",
    group: "High School",
    workout: "Incomplete",
    habits: "2/5",
    streak: 1,
    score: 54,
    status: "Needs Check-In"
  },
  {
    name: "Ryan Smith",
    group: "Pitchers",
    workout: "No Check-In",
    habits: "0/5",
    streak: 0,
    score: 20,
    status: "Missing"
  },
  {
    name: "Chris Miller",
    group: "Hitters",
    workout: "Complete",
    habits: "4/5",
    streak: 4,
    score: 88,
    status: "On Track"
  },
  {
    name: "Anthony Rivera",
    group: "High School",
    workout: "Complete",
    habits: "5/5",
    streak: 9,
    score: 98,
    status: "On Track"
  },
  {
    name: "Jake Thompson",
    group: "Pitchers",
    workout: "Incomplete",
    habits: "3/5",
    streak: 2,
    score: 67,
    status: "Watch"
  }
];

const pageTitles = {
  dashboard: "Dashboard",
  workout: "Today's Workout",
  habits: "Daily Habits",
  progress: "Progress",
  goals: "Goals",
  leaderboard: "Leaderboard",
  "coach-dashboard": "Coach Dashboard",
  athletes: "Athletes",
  "assign-workout": "Assign Workout",
  "coach-notes": "Coach Notes",
  "coach-leaderboard": "Leaderboard"
};

let currentMode = "athlete";

const pageTitle = document.getElementById("page-title");
const modeToggleBtn = document.getElementById("mode-toggle-btn");
const modeLabel = document.getElementById("mode-label");
const userRole = document.getElementById("user-role");

const athleteNav = document.getElementById("athlete-nav");
const coachNav = document.getElementById("coach-nav");

const addGoalBtn = document.getElementById("add-goal-btn");
const cancelGoalBtn = document.getElementById("cancel-goal-btn");
const goalForm = document.getElementById("goal-form");
const resetDayBtn = document.getElementById("reset-day-btn");

function getNavLinks() {
  return document.querySelectorAll(".nav-link");
}

function getSections() {
  return document.querySelectorAll(".page-section");
}

function showSection(sectionId) {
  getSections().forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  getNavLinks().forEach(link => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  pageTitle.textContent = pageTitles[sectionId];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupNavigation() {
  getNavLinks().forEach(link => {
    link.addEventListener("click", () => showSection(link.dataset.section));
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => showSection(button.dataset.go));
  });
}

function switchMode() {
  if (currentMode === "athlete") {
    currentMode = "coach";

    athleteNav.classList.add("hidden");
    coachNav.classList.remove("hidden");

    document.querySelectorAll(".athlete-section").forEach(section => section.classList.add("hidden"));
    document.querySelectorAll(".coach-section").forEach(section => section.classList.remove("hidden"));

    modeLabel.textContent = "Coach";
    userRole.textContent = "Coach";
    modeToggleBtn.textContent = "Switch to Athlete";

    showSection("coach-dashboard");
  } else {
    currentMode = "athlete";

    coachNav.classList.add("hidden");
    athleteNav.classList.remove("hidden");

    document.querySelectorAll(".coach-section").forEach(section => section.classList.add("hidden"));
    document.querySelectorAll(".athlete-section").forEach(section => section.classList.remove("hidden"));

    modeLabel.textContent = "Athlete";
    userRole.textContent = "Athlete";
    modeToggleBtn.textContent = "Switch to Coach";

    showSection("dashboard");
  }
}

function renderExercises() {
  const list = document.getElementById("exercise-list");

  list.innerHTML = exercises.map((exercise, index) => `
    <article class="exercise-card">
      <div class="exercise-info">
        <div class="exercise-number">${index + 1}</div>
        <div>
          <h4>${exercise.name}</h4>
          <p>${exercise.details}</p>
        </div>
      </div>
      <button class="check-btn ${exercise.complete ? "complete" : ""}" data-exercise="${index}">
        ${exercise.complete ? "✓" : ""}
      </button>
    </article>
  `).join("");

  document.querySelectorAll("[data-exercise]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.exercise);
      exercises[index].complete = !exercises[index].complete;
      saveState();
      renderExercises();
      updateDashboard();
    });
  });
}

function renderHabits() {
  const list = document.getElementById("habit-list");

  list.innerHTML = habits.map((habit, index) => `
    <article class="habit-card">
      <div>
        <h4>${habit.name}</h4>
        <p>${habit.category}</p>
      </div>
      <button class="check-btn ${habit.complete ? "complete" : ""}" data-habit="${index}">
        ${habit.complete ? "✓" : ""}
      </button>
    </article>
  `).join("");

  document.querySelectorAll("[data-habit]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.habit);
      habits[index].complete = !habits[index].complete;
      saveState();
      renderHabits();
      updateDashboard();
    });
  });
}

function renderGoals() {
  const list = document.getElementById("goal-list");

  list.innerHTML = goals.map((goal, index) => {
    const progress = Math.min(100, Math.round((goal.current / goal.target) * 100));
    const remaining = Math.max(0, goal.target - goal.current);

    return `
      <article class="goal-card">
        <div class="goal-card-top">
          <div>
            <p class="eyebrow">ACTIVE GOAL</p>
            <h4>${goal.name}</h4>
          </div>
          <button class="danger-btn" data-delete-goal="${index}">Delete</button>
        </div>

        <p>${goal.current} ${goal.unit} of ${goal.target} ${goal.unit}</p>

        <div class="progress-bar">
          <div style="width:${progress}%"></div>
        </div>

        <div class="goal-meta">
          <span>${progress}% complete</span>
          <span>${remaining} ${goal.unit} remaining</span>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-delete-goal]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.deleteGoal);
      const shouldDelete = confirm(`Delete goal: ${goals[index].name}?`);

      if (!shouldDelete) return;

      goals.splice(index, 1);
      saveState();
      renderGoals();
    });
  });
}

function renderCoachAthletes() {
  const preview = document.getElementById("coach-athlete-preview");
  const tableBody = document.getElementById("athlete-table-body");

  preview.innerHTML = athletes.slice(0, 4).map(athlete => `
    <div class="table-card">
      <div>
        <strong>${athlete.name}</strong>
        <span>${athlete.group} · Workout: ${athlete.workout} · Habits: ${athlete.habits}</span>
      </div>
      <span class="status-pill ${getStatusClass(athlete.status)}">${athlete.status}</span>
    </div>
  `).join("");

  tableBody.innerHTML = athletes.map(athlete => `
    <tr>
      <td>${athlete.name}</td>
      <td>${athlete.group}</td>
      <td>${athlete.workout}</td>
      <td>${athlete.habits}</td>
      <td>${athlete.streak} days</td>
      <td><span class="${getStatusClass(athlete.status)}">${athlete.status}</span></td>
    </tr>
  `).join("");
}

function renderLeaderboards() {
  const sortedAthletes = [...athletes].sort((a, b) => b.score - a.score);

  const leaderboardHtml = sortedAthletes.slice(0, 5).map((athlete, index) => `
    <div class="rank-row">
      <strong>${index + 1}</strong>
      <span>${athlete.name}</span>
      <em>${athlete.score}%</em>
    </div>
  `).join("");

  document.getElementById("athlete-leaderboard-list").innerHTML = leaderboardHtml;
  document.getElementById("coach-leaderboard-list").innerHTML = leaderboardHtml;
}

function getStatusClass(status) {
  if (status === "On Track") return "status-good";
  if (status === "Watch" || status === "Needs Check-In") return "status-warning";
  if (status === "Missing") return "status-danger";
  return "";
}

function updateDashboard() {
  const completedExercises = exercises.filter(item => item.complete).length;
  const workoutPercent = Math.round((completedExercises / exercises.length) * 100);

  const completedHabits = habits.filter(item => item.complete).length;
  const habitPercent = Math.round((completedHabits / habits.length) * 100);

  const dailyScore = Math.round((workoutPercent + habitPercent) / 2);

  document.getElementById("workout-progress").textContent = workoutPercent;
  document.getElementById("workout-page-progress").textContent = workoutPercent;
  document.getElementById("workout-count").textContent =
    `${completedExercises} of ${exercises.length} exercises complete`;

  document.getElementById("dashboard-workout-bar").style.width = `${workoutPercent}%`;

  document.getElementById("habit-progress").textContent = completedHabits;
  document.getElementById("habit-page-progress").textContent = completedHabits;

  document.getElementById("weekly-score").textContent = `${dailyScore}%`;

  document.getElementById("dashboard-habits").innerHTML = habits.slice(0, 4).map(habit => `
    <div class="habit-preview-item">
      <span>${habit.name}</span>
      <strong>${habit.complete ? "Done" : "Open"}</strong>
    </div>
  `).join("");
}

function saveState() {
  localStorage.setItem("ripCityExercises", JSON.stringify(exercises));
  localStorage.setItem("ripCityHabits", JSON.stringify(habits));
  localStorage.setItem("ripCityGoals", JSON.stringify(goals));
}

function loadState() {
  const savedExercises = JSON.parse(localStorage.getItem("ripCityExercises") || "null");
  const savedHabits = JSON.parse(localStorage.getItem("ripCityHabits") || "null");
  const savedGoals = JSON.parse(localStorage.getItem("ripCityGoals") || "null");

  if (Array.isArray(savedExercises)) {
    savedExercises.forEach((item, index) => {
      if (exercises[index]) exercises[index].complete = Boolean(item.complete);
    });
  }

  if (Array.isArray(savedHabits)) {
    savedHabits.forEach((item, index) => {
      if (habits[index]) habits[index].complete = Boolean(item.complete);
    });
  }

  if (Array.isArray(savedGoals)) {
    goals = savedGoals;
  }
}

function resetToday() {
  const shouldReset = confirm("Reset today's workout and habits?");

  if (!shouldReset) return;

  exercises.forEach(exercise => {
    exercise.complete = false;
  });

  habits.forEach(habit => {
    habit.complete = false;
  });

  saveState();
  renderExercises();
  renderHabits();
  updateDashboard();
}

addGoalBtn.addEventListener("click", () => {
  goalForm.classList.remove("hidden");
  document.getElementById("goal-name").focus();
});

cancelGoalBtn.addEventListener("click", () => {
  goalForm.reset();
  goalForm.classList.add("hidden");
});

goalForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("goal-name").value.trim();
  const current = Number(document.getElementById("goal-current").value);
  const target = Number(document.getElementById("goal-target").value);
  const unit = document.getElementById("goal-unit").value.trim() || "units";

  if (!name) {
    alert("Please enter a goal name.");
    return;
  }

  if (Number.isNaN(current) || current < 0) {
    alert("Please enter a valid current number.");
    return;
  }

  if (Number.isNaN(target) || target <= 0) {
    alert("Please enter a valid target number.");
    return;
  }

  goals.push({
    name,
    current,
    target,
    unit
  });

  saveState();
  renderGoals();

  goalForm.reset();
  goalForm.classList.add("hidden");
});

resetDayBtn.addEventListener("click", resetToday);
modeToggleBtn.addEventListener("click", switchMode);

document.getElementById("current-date").textContent = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric"
}).toUpperCase();

loadState();
setupNavigation();
renderExercises();
renderHabits();
renderGoals();
renderCoachAthletes();
renderLeaderboards();
updateDashboard();
protectAppPage();
