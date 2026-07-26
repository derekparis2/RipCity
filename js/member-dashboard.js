// =====================================================
// H2K HABIT TRACKING
// =====================================================
// This file controls the shared member dashboard.
// It loads assigned workouts for every member and H2K habits for H2K members.

let currentAccess = null;
let currentMemberProfile = null;
let currentMemberGroupIds = [];
let h2kHabits = [];
let todayLogs = [];
let todayWorkoutAssignments = [];
let futureWorkoutAssignments = [];
let futureCalendarMonth = getMonthStart(new Date());
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

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// H2K weekly scoring is Monday through Sunday.
function getStartOfWeekDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.getFullYear(), today.getMonth(), diff);
}

function getStartOfWeekString() {
  return formatLocalDate(getStartOfWeekDate());
}

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
  return window.RipCityAccess.requireApprovedAccess({
    extraProfileColumns: "profile_picture_url"
  });
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

function updateMemberShell() {
  const profile = currentAccess?.profile;
  const memberType = currentMemberProfile?.member_type === "h2k"
    ? "H2K Member"
    : "Athlete";
  const bandBadge = document.getElementById("member-band-color");
  const bandColor = currentMemberProfile?.h2k_band_color;

  document.getElementById("member-program-label").textContent = memberType;
  document.getElementById("member-sidebar-name").textContent = profile?.full_name || "Member";
  document.getElementById("member-sidebar-role").textContent = memberType;

  const avatar = document.getElementById("member-avatar");
  if (profile?.profile_picture_url) {
    avatar.classList.add("has-image");
    avatar.textContent = "";

    const image = document.createElement("img");
    image.src = profile.profile_picture_url;
    image.alt = "";
    image.addEventListener("error", () => {
      avatar.classList.remove("has-image");
      avatar.textContent = window.RipCityUI.safeInitials(profile?.full_name);
    });
    avatar.appendChild(image);
  } else {
    avatar.classList.remove("has-image");
    avatar.textContent = window.RipCityUI.safeInitials(profile?.full_name);
  }

  if (bandBadge) {
    bandBadge.textContent = bandColor ? `${bandColor} Band` : "Band not set";
    bandBadge.classList.toggle("hidden", currentMemberProfile?.member_type !== "h2k");
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  document.getElementById("member-dashboard-date").textContent = dateLabel;
}

function setupFeedbackLink() {
  const link = document.getElementById("member-feedback-link");
  if (!link) return;

  // The live Google Form URL is configured in js/ui-utils.js so every member
  // surface can use the same feedback destination.
  const url = window.RipCityUI.feedbackFormUrl;

  if (!url) {
    link.href = "#";
    link.textContent = "Feedback Form Coming Soon";
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
    return;
  }

  link.href = url;
  link.textContent = "Open Feedback Form";
  link.classList.remove("is-disabled");
  link.removeAttribute("aria-disabled");
}

function setActiveMemberNav(hash) {
  const normalizedHash = hash || "#member-dashboard-top";
  const historyPanel = document.getElementById("workout-history-panel");
  const futurePanel = document.getElementById("future-workouts-panel");

  document.querySelectorAll(".member-shell-nav .nav-link").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === normalizedHash);
  });

  if (normalizedHash === "#workout-history-panel" && historyPanel) {
    historyPanel.open = true;
  }

  if (normalizedHash === "#future-workouts-panel" && futurePanel) {
    futurePanel.open = true;
  }
}

function setupMemberSidebarNav() {
  document.querySelectorAll(".member-shell-nav .nav-link").forEach(link => {
    link.addEventListener("click", () => {
      setActiveMemberNav(link.getAttribute("href"));
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveMemberNav(window.location.hash);
  });

  setActiveMemberNav(window.location.hash);
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
          <h4>${window.RipCityUI.text(habit.name)}</h4>
          <p>${window.RipCityUI.text(habit.description, "Complete this habit for today.")}</p>
        </div>

        <button class="check-btn ${completed ? "complete" : ""}" data-habit-id="${window.RipCityUI.attr(habit.id)}">
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

// Updates H2K habit status values used for daily feedback.
async function updateScores() {
  const weeklyLogs = await loadWeeklyLogs(currentMemberProfile.id);
  const todayScore = todayLogs.filter(log => log.completed).length;
  const weeklyScore = weeklyLogs.reduce((total, log) => total + Number(log.points_earned || 0), 0);
  const weeklyMax = h2kHabits.length * 7;

  document.getElementById("today-score").textContent = todayScore;
  document.getElementById("weekly-score-h2k").textContent = weeklyScore;
  document.getElementById("member-stat-one-suffix").textContent = `/${h2kHabits.length}`;
  document.getElementById("member-stat-two-suffix").textContent = `/${weeklyMax}`;

  const status = document.getElementById("h2k-status");
  const detail = document.getElementById("h2k-status-detail");

  if (!status || !detail) return;

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
  // Habits and status are refreshed together so the dashboard state matches
  // the checkmark cards below.
  todayLogs = await loadTodayLogs(currentMemberProfile.id);
  renderHabitCards();
  await updateScores();
}

function toggleH2KModuleVisibility() {
  const isH2K = currentMemberProfile?.member_type === "h2k";
  const habitsSection = document.getElementById("h2k-habits-section");
  const habitsNavLink = document.getElementById("member-habits-nav-link");
  const statsSection = document.getElementById("member-stats-section");
  const trainingProgressCard = document.getElementById("member-training-progress-card");

  if (statsSection) {
    statsSection.classList.remove("hidden");
  }

  if (trainingProgressCard) {
    trainingProgressCard.classList.toggle("hidden", isH2K);
  }

  if (habitsSection) {
    habitsSection.classList.toggle("hidden", !isH2K);
  }

  if (habitsNavLink) {
    habitsNavLink.classList.toggle("hidden", !isH2K);
  }

  if (isH2K) {
    document.getElementById("member-stat-one-label").textContent = "Today’s Score";
    document.getElementById("member-stat-one-detail").textContent = "Habits completed today";
    document.getElementById("member-stat-two-label").textContent = "Weekly Score";
    document.getElementById("member-stat-two-detail").textContent = "Possible weekly points";
    document.getElementById("member-stat-one-suffix").textContent = `/${h2kHabits.length || 6}`;
    document.getElementById("member-stat-two-suffix").textContent = `/${(h2kHabits.length || 6) * 7}`;
    return;
  }

  if (!isH2K) {
    document.getElementById("member-stat-one-label").textContent = "Today’s Workouts";
    document.getElementById("member-stat-one-detail").textContent = "Assigned for today";
    document.getElementById("member-stat-two-label").textContent = "Completed";
    document.getElementById("member-stat-two-detail").textContent = "Finished assigned workouts";
    document.getElementById("member-stat-three-label").textContent = "Training Progress";
    document.getElementById("member-stat-three-detail").textContent = "Logged sets across assigned workouts";
    document.getElementById("member-stat-one-suffix").textContent = "";
    document.getElementById("member-stat-two-suffix").textContent = "";
    document.getElementById("member-stat-three-suffix").textContent = "";
    document.getElementById("h2k-status").textContent = "Training";
    document.getElementById("h2k-status-detail").textContent = "Open assigned workouts and track progress";

    if (window.location.hash === "#h2k-habits-section") {
      window.location.hash = "#member-dashboard-top";
      setActiveMemberNav("#member-dashboard-top");
    }
  }
}

function updateSharedWorkoutStats() {
  if (currentMemberProfile?.member_type === "h2k") return;

  const summaries = workoutHistoryAssignments.map(assignment => {
    const logs = workoutHistoryLogs.filter(log => log.workout_assignment_id === assignment.id);
    return window.RipCityWorkoutData.summarizeSetLogs(logs, assignment.workout);
  });
  const completedCount = summaries.filter(summary => summary.isComplete).length;
  const completedSets = summaries.reduce((total, summary) => total + summary.completedSets, 0);
  const totalSets = summaries.reduce((total, summary) => total + summary.totalSets, 0);
  const activeCount = summaries.filter(summary => summary.completedSets > 0 && !summary.isComplete).length;

  document.getElementById("today-score").textContent = todayWorkoutAssignments.length;
  document.getElementById("weekly-score-h2k").textContent = completedCount;
  document.getElementById("weekly-percent-h2k").textContent = `${completedSets}/${totalSets}`;

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
            <p class="eyebrow">${window.RipCityUI.text(workout.focus, "Workout")}</p>
            <h3>${window.RipCityUI.text(workout.title)}</h3>
            <p>${window.RipCityUI.text(workout.description, "No description added.")}</p>
          </div>

          <div class="today-workout-actions">
            <div class="today-workout-meta">
              <span>${window.RipCityUI.text(workout.estimated_minutes || "—")} min</span>
              <span>${window.RipCityUI.text(assignment.assigned_date)}</span>
            </div>

            <a class="primary-link workout-open-link" href="workout-session.html?assignment=${window.RipCityUI.attr(assignment.id)}">
              Open Workout
            </a>
          </div>
        </div>

        <div class="today-workout-blocks">
          ${blocks.map(block => {
            return `
              <div class="today-workout-block">
                <h4>${window.RipCityUI.text(block.name)}</h4>

                <div class="today-exercise-list">
                  ${window.RipCityWorkoutData.getBlockExercises(block).map(exercise => `
                    <article class="today-exercise-card">
                      <div>
                        <strong>${window.RipCityUI.text(exercise.name)}</strong>
                        <p>${window.RipCityUI.text(exercise.description, "No details added.")}</p>
                      </div>

                      <div class="today-exercise-meta">
                        ${exercise.sets || exercise.reps ? `<span>${window.RipCityUI.text(exercise.sets || "—")} x ${window.RipCityUI.text(exercise.reps || "—")}</span>` : ""}
                        ${exercise.tempo ? `<span>Tempo: ${window.RipCityUI.text(exercise.tempo)}</span>` : ""}
                        ${exercise.rest_time ? `<span>Rest: ${window.RipCityUI.text(exercise.rest_time)}</span>` : ""}
                        ${exercise.input_type ? `<span>${formatInputType(exercise.input_type)}</span>` : ""}
                      </div>

                      ${exercise.coach_note ? `
                        <p class="coach-note-preview">
                          Coach note: ${window.RipCityUI.text(exercise.coach_note)}
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
// FUTURE + PAST WORKOUTS
// =====================================================
// Future and past workout lists use the same assignment visibility as today's
// workout. Past rows join saved set logs to show completion without trusting
// client-only state.

function showWorkoutHistoryMessage(message, isError = false) {
  const element = document.getElementById("workout-history-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function loadWorkoutHistory() {
  const list = document.getElementById("workout-history-list");
  const futureList = document.getElementById("future-workout-list");

  if ((!list && !futureList) || !currentMemberProfile) return;

  showWorkoutHistoryMessage("Loading assigned workouts...");

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
      .or(targetFilters)
      .order("assigned_date", { ascending: false })
      .limit(60);

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
    const pastAssignments = assignments.filter(assignment => assignment.assigned_date < today);
    const currentOrPastAssignments = assignments.filter(assignment => assignment.assigned_date <= today);
    const upcomingAssignments = assignments
      .filter(assignment => assignment.assigned_date > today)
      .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date));

    const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
      currentOrPastAssignments.map(assignment => assignment.id),
      currentMemberProfile.id
    );
    futureWorkoutAssignments = upcomingAssignments;
    workoutHistoryAssignments = currentOrPastAssignments;
    workoutHistoryLogs = logs;

    renderFutureWorkouts(upcomingAssignments);
    renderWorkoutHistory(pastAssignments, logs);
    updateSharedWorkoutStats();
    showWorkoutHistoryMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutHistoryMessage(error.message || "Could not load assigned workouts.", true);
    if (futureList) futureList.innerHTML = `<div class="empty-state">Could not load upcoming workouts.</div>`;
    if (list) list.innerHTML = `<div class="empty-state">Could not load past workouts.</div>`;
  }
}

function renderFutureWorkouts(assignments) {
  const list = document.getElementById("future-workout-list");
  if (!list) return;

  const visibleAssignments = assignments.filter(assignment => {
    const date = parseAssignmentDate(assignment.assigned_date);
    return date.getFullYear() === futureCalendarMonth.getFullYear()
      && date.getMonth() === futureCalendarMonth.getMonth();
  });
  const month = buildCalendarMonth(futureCalendarMonth, visibleAssignments);
  const canGoBack = futureCalendarMonth > getMonthStart(new Date());

  list.innerHTML = `
    <section class="future-calendar-month">
      <div class="future-calendar-heading">
        <button class="icon-btn future-month-btn" type="button" data-future-month="prev" ${canGoBack ? "" : "disabled"} aria-label="Previous month">
          ‹
        </button>
        <h4>${window.RipCityUI.text(month.label)}</h4>
        <button class="icon-btn future-month-btn" type="button" data-future-month="next" aria-label="Next month">
          ›
        </button>
      </div>

      <div class="future-calendar-grid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `
          <span class="future-calendar-day-label">${day}</span>
        `).join("")}

        ${month.cells.map(cell => {
          if (!cell) return `<span class="future-calendar-cell is-empty"></span>`;

          return `
            <article class="future-calendar-cell ${cell.assignments.length ? "has-workout" : ""}">
              <span class="future-calendar-date">${cell.day}</span>

              ${cell.assignments.map(assignment => `
                <a class="future-calendar-workout" href="workout-session.html?assignment=${window.RipCityUI.attr(assignment.id)}">
                  ${window.RipCityUI.text(assignment.workout?.title, "Untitled Workout")}
                </a>
              `).join("")}
            </article>
          `;
        }).join("")}
      </div>

      ${visibleAssignments.length ? "" : `<p class="future-calendar-empty">No future workouts this month.</p>`}
    </section>
  `;

  document.querySelectorAll("[data-future-month]").forEach(button => {
    button.addEventListener("click", () => changeFutureCalendarMonth(button.dataset.futureMonth));
  });
}

function changeFutureCalendarMonth(direction) {
  const nextMonth = new Date(futureCalendarMonth);
  nextMonth.setMonth(nextMonth.getMonth() + (direction === "next" ? 1 : -1));
  futureCalendarMonth = nextMonth < getMonthStart(new Date())
    ? getMonthStart(new Date())
    : nextMonth;
  renderFutureWorkouts(futureWorkoutAssignments);
}

function buildCalendarMonth(monthDate, assignments) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
  const assignmentsByDay = new Map();

  assignments.forEach(assignment => {
    const date = parseAssignmentDate(assignment.assigned_date);
    const day = date.getDate();
    const dayAssignments = assignmentsByDay.get(day) || [];
    dayAssignments.push(assignment);
    assignmentsByDay.set(day, dayAssignments);
  });

  const cells = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      assignments: assignmentsByDay.get(day) || []
    });
  }

  return {
    cells,
    label
  };
}

function parseAssignmentDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function renderWorkoutHistory(assignments, logs) {
  const list = document.getElementById("workout-history-list");

  if (!assignments.length) {
    list.innerHTML = `<div class="empty-state compact-empty-state">No past workouts yet.</div>`;
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
      <article class="workout-history-card compact-workout-row">
        <div class="workout-history-main">
          <div>
            <p class="eyebrow">${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(assignment.assigned_date))}</p>
            <h4>${window.RipCityUI.text(workout?.title, "Untitled Workout")}</h4>
            <p>${window.RipCityUI.text(status)} · ${summary.completedSets}/${summary.totalSets} sets</p>
          </div>

          <a class="outline-link workout-open-link" href="workout-session.html?assignment=${window.RipCityUI.attr(assignment.id)}">
            Review
          </a>
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
    updateMemberShell();

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
  setupMemberSidebarNav();
  setupFeedbackLink();
  initH2KDashboard();

  document.getElementById("refresh-workout-btn")?.addEventListener("click", loadTodayAssignedWorkouts);
  document.getElementById("refresh-workout-lists-btn")?.addEventListener("click", loadWorkoutHistory);
  document.getElementById("refresh-history-btn")?.addEventListener("click", loadWorkoutHistory);
  document.getElementById("refresh-habits-btn")?.addEventListener("click", refreshH2KDashboard);
  document.getElementById("h2k-logout-btn")?.addEventListener("click", logoutH2K);
});
