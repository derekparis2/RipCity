// =====================================================
// H2K HABIT TRACKING
// =====================================================
// This file controls the H2K member dashboard.
// It loads the six Rip City habits from Supabase,
// lets a member check them off for today,
// saves those check-ins to habit_logs,
// and calculates today + weekly scores.

let currentAccess = null;
let currentMemberProfile = null;
let currentMemberGroupIds = [];
let h2kHabits = [];
let todayLogs = [];
let todayWorkoutAssignments = [];
let workoutHistoryAssignments = [];
let workoutHistoryLogs = [];

const MEMBER_WORKOUT_ASSIGNMENT_SELECT = `
  id,
  assigned_date,
  target_type,
  target_facility_id,
  target_group_id,
  target_member_profile_id,
  workout:workouts (
    id,
    facility_id,
    title,
    focus,
    description,
    estimated_minutes,
    workout_blocks (
      id,
      name,
      block_order,
      workout_exercises (
        id,
        name,
        description,
        sets,
        reps,
        tempo,
        rest_time,
        input_type,
        video_url,
        coach_note,
        exercise_order
      )
    )
  )
`;

// Gets today's date in YYYY-MM-DD format.
// This is the format we store in Supabase date fields.
function formatLocalDate(date) {
  // Supabase date columns store local calendar days, not UTC instants.
  // Using toISOString() here can move "today" to tomorrow after evening ET.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return window.RipCityWorkoutData?.getTodayString
    ? window.RipCityWorkoutData.getTodayString()
    : formatLocalDate(new Date());
}

// Gets the Monday of the current week.
// This lets us calculate the 42-point weekly score.
function getStartOfWeekDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.getFullYear(), today.getMonth(), diff);
}

function getStartOfWeekString() {
  const monday = getStartOfWeekDate();
  return formatLocalDate(monday);
}

// Gets the Sunday of the current week.
function getEndOfWeekString() {
  const start = getStartOfWeekDate();
  start.setDate(start.getDate() + 6);
  return formatLocalDate(start);
}

// Shows messages on the H2K page.
function showH2KMessage(message, isError = false) {
  const element = document.getElementById("h2k-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

// Gets the logged-in user and confirms they are approved for one facility.
async function getApprovedUserAccess() {
  return window.RipCityAccess.requireApprovedAccess();
}

// Gets the member profile connected to the approved user.
// This tells us whether they are athlete or h2k.
async function getMemberProfile(facilityMemberId) {
  return window.RipCityAccess.getMemberProfileForMembership(facilityMemberId);
}

// Loads the H2K habits that were seeded into Supabase.
async function loadHabits(facilityId) {
  const { data, error } = await db
    .from("habits")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

// Loads today's habit logs for the current member.
async function loadTodayLogs(memberProfileId) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .eq("log_date", getTodayString());

  if (error) throw error;
  return data || [];
}

// Loads this week's habit logs so we can calculate the weekly score out of 42.
async function loadWeeklyLogs(memberProfileId) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .gte("log_date", getStartOfWeekString())
    .lte("log_date", getEndOfWeekString());

  if (error) throw error;
  return data || [];
}

// Checks if a habit has already been completed today.
function isHabitCompleteToday(habitId) {
  return todayLogs.some(log => log.habit_id === habitId && log.completed);
}

// Renders the list of six habits as checkable cards.
function renderHabitCards() {
  const list = document.getElementById("h2k-habit-list");

  if (!h2kHabits.length) {
    list.innerHTML = `<div class="empty-state">No habits found.</div>`;
    return;
  }

  list.innerHTML = h2kHabits.map(habit => {
    const completed = isHabitCompleteToday(habit.id);

    return `
      <article class="h2k-habit-card ${completed ? "complete" : ""}">
        <div>
          <h4>${habit.name}</h4>
          <p>${habit.description || "Complete this habit for today."}</p>
        </div>

        <button class="check-btn ${completed ? "complete" : ""}" data-habit-id="${habit.id}">
          ${completed ? "✓" : ""}
        </button>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-habit-id]").forEach(button => {
    button.addEventListener("click", () => toggleHabit(button.dataset.habitId));
  });
}

// Saves or updates a habit log for today.
// If checked, completed = true and points_earned = 1.
// If unchecked, completed = false and points_earned = 0.
async function toggleHabit(habitId) {
  const completedNow = !isHabitCompleteToday(habitId);

  showH2KMessage("Saving habit...");

  try {
    const { error } = await db
      .from("habit_logs")
      .upsert(
        {
          member_profile_id: currentMemberProfile.id,
          habit_id: habitId,
          log_date: getTodayString(),
          completed: completedNow,
          points_earned: completedNow ? 1 : 0
        },
        {
          onConflict: "member_profile_id,habit_id,log_date"
        }
      );

    if (error) throw error;

    await refreshH2KDashboard();
    showH2KMessage("");
  } catch (error) {
    console.error(error);
    showH2KMessage(error.message || "Could not save habit.", true);
  }
}

// Updates the score cards at the top of the page.
async function updateScores() {
  const weeklyLogs = await loadWeeklyLogs(currentMemberProfile.id);

  const todayScore = todayLogs.filter(log => log.completed).length;
  const weeklyScore = weeklyLogs.reduce((total, log) => total + Number(log.points_earned || 0), 0);
  const weeklyMax = h2kHabits.length * 7;
  const weeklyPercent = weeklyMax > 0 ? Math.round((weeklyScore / weeklyMax) * 100) : 0;

  document.getElementById("today-score").textContent = todayScore;
  document.getElementById("weekly-score-h2k").textContent = weeklyScore;
  document.getElementById("score-box-weekly").textContent = weeklyScore;
  document.getElementById("weekly-percent-h2k").textContent = weeklyPercent;
  document.getElementById("h2k-weekly-bar").style.width = `${weeklyPercent}%`;

  const status = document.getElementById("h2k-status");
  const detail = document.getElementById("h2k-status-detail");

  if (todayScore === h2kHabits.length) {
    status.textContent = "Complete";
    detail.textContent = "All habits completed today";
  } else {
    status.textContent = "Open";
    detail.textContent = `${h2kHabits.length - todayScore} habits left today`;
  }
}

// Reloads today logs, re-renders cards, and updates scores.
async function refreshH2KDashboard() {
  // Habits and scores are refreshed together so the top stat cards always
  // match the checkmark cards below.
  todayLogs = await loadTodayLogs(currentMemberProfile.id);
  renderHabitCards();
  await updateScores();
}

function toggleH2KModuleVisibility() {
  const isH2K = currentMemberProfile?.member_type === "h2k";
  const habitsSection = document.getElementById("h2k-habits-section");

  if (habitsSection) {
    habitsSection.classList.toggle("hidden", !isH2K);
  }

  if (!isH2K) {
    document.getElementById("member-stat-one-label").textContent = "Today’s Workouts";
    document.getElementById("member-stat-one-detail").textContent = "Assigned for today";
    document.getElementById("member-stat-two-label").textContent = "Completed";
    document.getElementById("member-stat-two-detail").textContent = "Finished assigned workouts";
    document.getElementById("member-stat-three-label").textContent = "Training Progress";
    document.getElementById("member-stat-three-detail").textContent = "Average logged set completion";
    document.getElementById("member-stat-one-suffix").textContent = "";
    document.getElementById("member-stat-two-suffix").textContent = "";
    document.getElementById("h2k-status").textContent = "Training";
    document.getElementById("h2k-status-detail").textContent = "Open assigned workouts and track progress";
  }
}

function updateSharedWorkoutStats() {
  if (currentMemberProfile?.member_type === "h2k") return;

  const summaries = workoutHistoryAssignments.map(assignment => {
    const logs = workoutHistoryLogs.filter(log => log.workout_assignment_id === assignment.id);
    return window.RipCityWorkoutData.summarizeSetLogs(logs, assignment.workout);
  });
  const completedCount = summaries.filter(summary => summary.isComplete).length;
  const averagePercent = summaries.length
    ? Math.round(summaries.reduce((total, summary) => total + summary.completionPercent, 0) / summaries.length)
    : 0;
  const activeCount = summaries.filter(summary => summary.completedSets > 0 && !summary.isComplete).length;

  document.getElementById("today-score").textContent = todayWorkoutAssignments.length;
  document.getElementById("weekly-score-h2k").textContent = completedCount;
  document.getElementById("weekly-percent-h2k").textContent = averagePercent;

  const status = document.getElementById("h2k-status");
  const detail = document.getElementById("h2k-status-detail");

  if (activeCount > 0) {
    status.textContent = "In Progress";
    detail.textContent = `${activeCount} workout${activeCount === 1 ? "" : "s"} partially logged`;
  } else if (todayWorkoutAssignments.length) {
    status.textContent = "Ready";
    detail.textContent = "Open today's assigned workout";
  } else {
    status.textContent = "Clear";
    detail.textContent = "No workout assigned for today";
  }
}

// =====================================================
// TODAY'S WORKOUT
// =====================================================
// Loads workouts assigned to this member, their groups, or the whole facility for today's date.
// This supports the flow:
// Coach creates workout -> assigns to group/date -> member sees today's lift.

function showTodayWorkoutMessage(message, isError = false) {
  const element = document.getElementById("today-workout-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function getCurrentMemberGroupIds(memberProfileId) {
  return window.RipCityWorkoutData.loadMemberGroupIds(memberProfileId);
}

async function loadTodayAssignedWorkouts() {
  const container = document.getElementById("today-workout-container");

  if (!container || !currentMemberProfile) return;

  showTodayWorkoutMessage("Loading today’s workout...");

  try {
    const today = getTodayString();
    const facilityId = currentAccess.membership.facility_id;
    const targetFilters = window.RipCityWorkoutData.buildMemberAssignmentOrFilter({
      facilityId,
      memberProfileId: currentMemberProfile.id,
      groupIds: currentMemberGroupIds
    });

    const { data, error } = await db
      .from("workout_assignments")
      .select(MEMBER_WORKOUT_ASSIGNMENT_SELECT)
      .eq("assigned_date", today)
      .or(targetFilters);

    if (error) throw error;

    const visibleAssignments = (data || []).filter(assignment => {
      return window.RipCityWorkoutData.isAssignmentVisibleToMember(assignment, {
        facilityId,
        memberProfileId: currentMemberProfile.id,
        groupIds: currentMemberGroupIds
      });
    });

    const accessibleAssignments = window.RipCityWorkoutData
      .dedupeAssignmentsByWorkoutDate(visibleAssignments);
    todayWorkoutAssignments = accessibleAssignments;

    renderTodayWorkouts(accessibleAssignments);
    updateSharedWorkoutStats();
    showTodayWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showTodayWorkoutMessage(error.message || "Could not load today’s workout.", true);

    container.innerHTML = `
      <div class="empty-state">
        Could not load today’s workout.
      </div>
    `;
  }
}

function renderTodayWorkouts(assignments) {
  const container = document.getElementById("today-workout-container");

  if (!assignments.length) {
    container.innerHTML = `
      <div class="empty-state">
        No workout assigned for today.
      </div>
    `;
    return;
  }

  container.innerHTML = assignments.map(assignment => {
    const workout = assignment.workout;

    if (!workout) {
      return `
        <div class="empty-state">
          Workout details unavailable.
        </div>
      `;
    }

    // Blocks and exercises are sorted here because Supabase nested results are
    // not guaranteed to come back in display order.
    const blocks = window.RipCityWorkoutData.getWorkoutBlocks(workout);

    return `
      <article class="today-workout-card">
        <div class="today-workout-header">
          <div>
            <p class="eyebrow">${workout.focus || "Workout"}</p>
            <h3>${workout.title}</h3>
            <p>${workout.description || "No description added."}</p>
          </div>

          <div class="today-workout-actions">
            <div class="today-workout-meta">
              <span>${workout.estimated_minutes || "—"} min</span>
              <span>${assignment.assigned_date}</span>
            </div>

            <a class="primary-link workout-open-link" href="workout-session.html?assignment=${assignment.id}">
              Open Workout
            </a>
          </div>
        </div>

        <div class="today-workout-blocks">
          ${blocks.map(block => {
            return `
              <div class="today-workout-block">
                <h4>${block.name}</h4>

                <div class="today-exercise-list">
                  ${window.RipCityWorkoutData.getBlockExercises(block).map(exercise => `
                    <article class="today-exercise-card">
                      <div>
                        <strong>${exercise.name}</strong>
                        <p>${exercise.description || "No details added."}</p>
                      </div>

                      <div class="today-exercise-meta">
                        ${exercise.sets || exercise.reps ? `<span>${exercise.sets || "—"} x ${exercise.reps || "—"}</span>` : ""}
                        ${exercise.tempo ? `<span>Tempo: ${exercise.tempo}</span>` : ""}
                        ${exercise.rest_time ? `<span>Rest: ${exercise.rest_time}</span>` : ""}
                        ${exercise.input_type ? `<span>${formatInputType(exercise.input_type)}</span>` : ""}
                      </div>

                      ${exercise.coach_note ? `
                        <p class="coach-note-preview">
                          Coach note: ${exercise.coach_note}
                        </p>
                      ` : ""}
                    </article>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

// =====================================================
// WORKOUT HISTORY
// =====================================================
// History uses the same assignment visibility as today's workout, then joins
// saved set logs to show completion without trusting client-only state.

function showWorkoutHistoryMessage(message, isError = false) {
  const element = document.getElementById("workout-history-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function loadWorkoutHistory() {
  const list = document.getElementById("workout-history-list");

  if (!list || !currentMemberProfile) return;

  showWorkoutHistoryMessage("Loading workout history...");

  try {
    const facilityId = currentAccess.membership.facility_id;
    const targetFilters = window.RipCityWorkoutData.buildMemberAssignmentOrFilter({
      facilityId,
      memberProfileId: currentMemberProfile.id,
      groupIds: currentMemberGroupIds
    });

    const { data, error } = await db
      .from("workout_assignments")
      .select(MEMBER_WORKOUT_ASSIGNMENT_SELECT)
      .lte("assigned_date", getTodayString())
      .or(targetFilters)
      .order("assigned_date", { ascending: false })
      .limit(30);

    if (error) throw error;

    const visibleAssignments = (data || []).filter(assignment => {
      return window.RipCityWorkoutData.isAssignmentVisibleToMember(assignment, {
        facilityId,
        memberProfileId: currentMemberProfile.id,
        groupIds: currentMemberGroupIds
      });
    });

    const assignments = window.RipCityWorkoutData
      .dedupeAssignmentsByWorkoutDate(visibleAssignments)
      .sort((a, b) => b.assigned_date.localeCompare(a.assigned_date));

    const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
      assignments.map(assignment => assignment.id),
      currentMemberProfile.id
    );
    workoutHistoryAssignments = assignments;
    workoutHistoryLogs = logs;

    renderWorkoutHistory(assignments, logs);
    updateSharedWorkoutStats();
    showWorkoutHistoryMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutHistoryMessage(error.message || "Could not load workout history.", true);
    list.innerHTML = `<div class="empty-state">Could not load workout history.</div>`;
  }
}

function renderWorkoutHistory(assignments, logs) {
  const list = document.getElementById("workout-history-list");

  if (!assignments.length) {
    list.innerHTML = `<div class="empty-state">No completed or previously assigned workouts yet.</div>`;
    return;
  }

  list.innerHTML = assignments.map(assignment => {
    const workout = assignment.workout;
    const assignmentLogs = logs.filter(log => log.workout_assignment_id === assignment.id);
    const summary = window.RipCityWorkoutData.summarizeSetLogs(assignmentLogs, workout);
    const status = summary.isComplete
      ? "Complete"
      : summary.completedSets > 0
        ? "In Progress"
        : "Not Started";

    return `
      <article class="workout-history-card">
        <div class="workout-history-main">
          <div>
            <p class="eyebrow">${workout?.focus || "Workout"}</p>
            <h4>${workout?.title || "Untitled Workout"}</h4>
            <p>${workout?.description || "No description added."}</p>
          </div>

          <a class="primary-link workout-open-link" href="workout-session.html?assignment=${assignment.id}">
            Review Workout
          </a>
        </div>

        <div class="workout-history-stats">
          <span><strong>${window.RipCityWorkoutData.formatDateLabel(assignment.assigned_date)}</strong> Assigned</span>
          <span><strong>${status}</strong> Status</span>
          <span><strong>${summary.completedSets}/${summary.totalSets}</strong> Sets</span>
          <span><strong>${window.RipCityWorkoutData.formatDateTimeLabel(summary.lastLoggedAt)}</strong> Last Logged</span>
        </div>

        <div class="progress-bar workout-history-progress">
          <div style="width: ${summary.completionPercent}%"></div>
        </div>
      </article>
    `;
  }).join("");
}

function formatInputType(inputType) {
  const labels = {
    completion: "Completion",
    weight_reps: "Weight + Reps",
    band_color: "Band Color",
    time: "Time",
    distance: "Distance",
    custom: "Custom"
  };

  return labels[inputType] || inputType;
}

// Main startup function for the H2K page.
async function initH2KDashboard() {
  showH2KMessage("Loading H2K dashboard...");

  try {
    // Startup order matters: access -> member profile -> facility habits/workouts.
    currentAccess = await getApprovedUserAccess();
    if (!currentAccess) return;

    currentMemberProfile = await getMemberProfile(currentAccess.membership.id);

    currentMemberGroupIds = await getCurrentMemberGroupIds(currentMemberProfile.id);
    toggleH2KModuleVisibility();

    if (currentMemberProfile.member_type === "h2k") {
      h2kHabits = await loadHabits(currentAccess.membership.facility_id);
    }

    await loadTodayAssignedWorkouts();
    await loadWorkoutHistory();

    if (currentMemberProfile.member_type === "h2k") {
      await refreshH2KDashboard();
    }

    showH2KMessage("");
  } catch (error) {
    console.error(error);
    showH2KMessage(error.message || "Could not load H2K dashboard.", true);
  }
}

// Logs out the current user.
async function logoutH2K() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  initH2KDashboard();

  document.getElementById("refresh-workout-btn")?.addEventListener("click", loadTodayAssignedWorkouts);
  document.getElementById("refresh-history-btn")?.addEventListener("click", loadWorkoutHistory);
  document.getElementById("refresh-habits-btn")?.addEventListener("click", refreshH2KDashboard);
  document.getElementById("h2k-logout-btn")?.addEventListener("click", logoutH2K);
});
