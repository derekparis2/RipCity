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
let workoutCalendarAssignments = [];
let workoutCalendarLogs = [];
let workoutCalendarMonth = getMonthStart(new Date());
let selectedWorkoutDate = getTodayString();
let memberHistoryWeeks = [];
let memberHistoryLogs = [];
let selectedMemberHistoryWeekIndex = 0;

const MEMBER_WEEKLY_HISTORY_WEEKS = 8;

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

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function buildRecentWeekRanges(weekCount) {
  const currentWeekStart = getStartOfWeekDate();

  return Array.from({ length: weekCount }, (_, index) => {
    const start = addDays(currentWeekStart, index * -7);
    const end = addDays(start, 6);

    return {
      start,
      end,
      startKey: formatLocalDate(start),
      endKey: formatLocalDate(end),
      isCurrentWeek: index === 0
    };
  });
}

function formatWeekRangeLabel(week) {
  const startLabel = week.start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  const endLabel = week.end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });

  return `${startLabel} - ${endLabel}`;
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

async function loadHabitLogsForRange(memberProfileId, startDate, endDate) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

  if (error) throw error;
  return data || [];
}

// Checks if a habit has already been completed today.
function isHabitCompleteToday(habitId) {
  return todayLogs.some(log => log.habit_id === habitId && log.completed);
}

function getMemberTypeLabel(profileTypeValue = currentMemberProfile?.member_type) {
  const profileType = String(profileTypeValue || "").toLowerCase();
  const role = String(currentAccess?.membership?.role || "").toLowerCase();

  if (profileType === "h2k" || role === "h2k_member") return "H2K Member";
  if (profileType === "athlete" || role === "athlete") return "Athlete";

  return "Member";
}

function setMemberTypeText(memberType) {
  document.getElementById("member-program-label").textContent = memberType;
  document.getElementById("member-sidebar-role").textContent = memberType;

  const brandSubtitle = document.getElementById("member-brand-subtitle");
  if (brandSubtitle) {
    brandSubtitle.textContent = memberType;
  }
}

function updateMemberShell() {
  const profile = currentAccess?.profile;
  const memberType = getMemberTypeLabel();
  const bandBadge = document.getElementById("member-band-color");
  const bandColor = currentMemberProfile?.h2k_band_color;

  setMemberTypeText(memberType);
  document.getElementById("member-sidebar-name").textContent = profile?.full_name || "Member";

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
    bandBadge.textContent = bandColor ? `${bandColor} Band` : "No Band";
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
  const calendarPanel = document.getElementById("training-calendar-panel");

  document.querySelectorAll(".member-shell-nav .nav-link").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === normalizedHash);
  });

  if (normalizedHash === "#training-calendar-panel" && calendarPanel) {
    selectedWorkoutDate = getTodayString();
    workoutCalendarMonth = getMonthStart(parseAssignmentDate(selectedWorkoutDate));
    calendarPanel.open = true;
    renderTrainingCalendar();
  }

  if (normalizedHash === "#member-history-section") {
    const historyPanel = document.getElementById("member-history-section");
    if (historyPanel) historyPanel.open = true;
  }
}

function scrollMemberHashIntoView() {
  const hash = window.location.hash;
  if (!hash) return;

  const target = document.querySelector(hash);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({
      block: "start",
      behavior: "smooth"
    });
  });
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
    await loadMemberWeeklyHistory();
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

function showMemberWeeklyHistoryMessage(message, isError = false) {
  const element = document.getElementById("member-weekly-history-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function loadMemberWeeklyHistory() {
  const list = document.getElementById("member-weekly-history-list");
  if (!list || !currentMemberProfile) return;

  showMemberWeeklyHistoryMessage("Loading member history...");

  try {
    memberHistoryWeeks = buildRecentWeekRanges(MEMBER_WEEKLY_HISTORY_WEEKS);
    selectedMemberHistoryWeekIndex = Math.min(
      selectedMemberHistoryWeekIndex,
      memberHistoryWeeks.length - 1
    );

    if (currentMemberProfile.member_type === "h2k") {
      memberHistoryLogs = await loadHabitLogsForRange(
        currentMemberProfile.id,
        memberHistoryWeeks[memberHistoryWeeks.length - 1].startKey,
        memberHistoryWeeks[0].endKey
      );
    } else {
      memberHistoryLogs = workoutCalendarLogs;
    }

    renderMemberWeeklyHistory();
    showMemberWeeklyHistoryMessage("");
  } catch (error) {
    console.error(error);
    showMemberWeeklyHistoryMessage(error.message || "Could not load member history.", true);
    list.innerHTML = `<div class="empty-state">Could not load member history.</div>`;
  }
}

function renderMemberWeeklyHistory() {
  const list = document.getElementById("member-weekly-history-list");
  if (!list) return;

  const week = memberHistoryWeeks[selectedMemberHistoryWeekIndex];
  if (!week) {
    list.innerHTML = `<div class="empty-state">No member history available yet.</div>`;
    return;
  }

  updateMemberHistoryStepper(week);

  const row = currentMemberProfile.member_type === "h2k"
    ? buildH2KWeeklyScoreRow(week, memberHistoryLogs, h2kHabits.length * 7)
    : buildTrainingWeeklyScoreRow(week);

  list.innerHTML = renderWeeklyScoreCard(row);
}

function updateMemberHistoryStepper(week) {
  const context = document.getElementById("member-history-week-context");
  const label = document.getElementById("member-history-week-label");
  const eyebrow = document.getElementById("member-history-eyebrow");
  const previousButton = document.getElementById("member-history-prev-week");
  const nextButton = document.getElementById("member-history-next-week");

  if (context) context.textContent = week.isCurrentWeek ? "CURRENT WEEK" : "WEEK";
  if (label) label.textContent = formatWeekRangeLabel(week);
  if (eyebrow) {
    eyebrow.textContent = currentMemberProfile?.member_type === "h2k"
      ? "H2K PROGRESS"
      : "TRAINING PROGRESS";
  }
  if (previousButton) previousButton.disabled = selectedMemberHistoryWeekIndex >= memberHistoryWeeks.length - 1;
  if (nextButton) nextButton.disabled = selectedMemberHistoryWeekIndex <= 0;
}

function changeMemberHistoryWeek(direction) {
  if (!memberHistoryWeeks.length) return;

  selectedMemberHistoryWeekIndex += direction === "previous" ? 1 : -1;
  selectedMemberHistoryWeekIndex = Math.max(
    0,
    Math.min(selectedMemberHistoryWeekIndex, memberHistoryWeeks.length - 1)
  );

  renderMemberWeeklyHistory();
}

function buildH2KWeeklyScoreRow(week, logs, maxWeeklyScore) {
  const weekLogs = logs.filter(log =>
    log.log_date >= week.startKey &&
    log.log_date <= week.endKey
  );
  const score = weekLogs
    .filter(log => log.completed)
    .reduce((total, log) => total + Number(log.points_earned || 0), 0);
  const loggedDays = new Set(
    weekLogs
      .filter(log => log.completed)
      .map(log => log.log_date)
  ).size;

  return {
    label: formatWeekRangeLabel(week),
    typeLabel: "H2K Score",
    score,
    maxScore: maxWeeklyScore,
    percent: maxWeeklyScore ? Math.round((score / maxWeeklyScore) * 100) : 0,
    loggedDays,
    detail: `${loggedDays}/7 days logged`,
    isCurrentWeek: week.isCurrentWeek
  };
}

function buildTrainingWeeklyScoreRow(week) {
  const weekAssignments = workoutCalendarAssignments.filter(assignment =>
    assignment.assigned_date >= week.startKey &&
    assignment.assigned_date <= week.endKey
  );
  const pastOrCurrentAssignments = weekAssignments.filter(assignment =>
    assignment.assigned_date <= getTodayString()
  );
  const summaries = pastOrCurrentAssignments.map(assignment => {
    const logs = workoutCalendarLogs.filter(log => log.workout_assignment_id === assignment.id);
    return window.RipCityWorkoutData.summarizeSetLogs(logs, assignment.workout);
  });
  const completedWorkouts = summaries.filter(summary => summary.isComplete).length;
  const completedSets = summaries.reduce((total, summary) => total + summary.completedSets, 0);
  const totalSets = summaries.reduce((total, summary) => total + summary.totalSets, 0);
  const assignedCount = pastOrCurrentAssignments.length;

  return {
    label: formatWeekRangeLabel(week),
    typeLabel: "Training Week",
    score: completedWorkouts,
    maxScore: assignedCount,
    percent: totalSets ? Math.round((completedSets / totalSets) * 100) : 0,
    loggedDays: new Set(pastOrCurrentAssignments.map(assignment => assignment.assigned_date)).size,
    detail: `${completedSets}/${totalSets} sets logged`,
    secondaryDetail: `${assignedCount} assigned workout${assignedCount === 1 ? "" : "s"}`,
    isCurrentWeek: week.isCurrentWeek
  };
}

function renderWeeklyScoreCard(row) {
  return `
    <article class="weekly-score-card ${row.isCurrentWeek ? "is-current-week" : ""}">
      <div class="weekly-score-main">
        <div>
          <p class="eyebrow">${window.RipCityUI.text(row.typeLabel)}</p>
          <h4>${window.RipCityUI.text(row.label)}</h4>
          <span>${window.RipCityUI.text(row.detail)}</span>
          ${row.secondaryDetail ? `<small>${window.RipCityUI.text(row.secondaryDetail)}</small>` : ""}
        </div>

        <strong>${row.score}/${row.maxScore}</strong>
      </div>

      <div class="progress-bar weekly-score-progress">
        <div style="width: ${window.RipCityUI.percent(row.percent)}%"></div>
      </div>
    </article>
  `;
}

function toggleH2KModuleVisibility() {
  const isH2K = currentMemberProfile?.member_type === "h2k";
  const habitsSection = document.getElementById("h2k-habits-section");
  const habitsNavLink = document.getElementById("member-habits-nav-link");
  const statsSection = document.getElementById("member-stats-section");
  const trainingProgressCard = document.getElementById("member-training-progress-card");

  document.body.classList.toggle("member-type-h2k", isH2K);
  document.body.classList.toggle("member-type-athlete", !isH2K);

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

  const today = getTodayString();
  const trackableAssignments = workoutCalendarAssignments.filter(assignment => assignment.assigned_date <= today);
  const summaries = trackableAssignments.map(assignment => {
    const logs = workoutCalendarLogs.filter(log => log.workout_assignment_id === assignment.id);
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

  if (!currentMemberProfile) return;

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

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          Could not load today’s workout.
        </div>
      `;
    }
  }
}

function renderTodayWorkouts(assignments) {
  const container = document.getElementById("today-workout-container");
  if (!container) return;

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
// TRAINING CALENDAR
// =====================================================
// The calendar uses the same assignment visibility as today's workout, then
// combines past, present, and future sessions into one member schedule.

function showWorkoutHistoryMessage(message, isError = false) {
  const element = document.getElementById("workout-history-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function loadWorkoutHistory() {
  const list = document.getElementById("workout-history-list");
  const calendar = document.getElementById("future-workout-list");

  if ((!list && !calendar) || !currentMemberProfile) return;

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

    const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
      assignments.map(assignment => assignment.id),
      currentMemberProfile.id
    );
    workoutCalendarAssignments = assignments;
    workoutCalendarLogs = logs;

    if (!selectedWorkoutDate) {
      selectedWorkoutDate = today;
    }

    renderTrainingCalendar();
    updateTrainingCalendarDefaultOpen(assignments, today);
    updateSharedWorkoutStats();
    showWorkoutHistoryMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutHistoryMessage(error.message || "Could not load assigned workouts.", true);
    if (calendar) calendar.innerHTML = `<div class="empty-state">Could not load assigned workouts.</div>`;
    if (list) list.innerHTML = `<div class="empty-state">Could not load schedule details.</div>`;
  }
}

function updateTrainingCalendarDefaultOpen(assignments, today) {
  const calendarPanel = document.getElementById("training-calendar-panel");
  if (!calendarPanel) return;

  const hasTodayWorkout = assignments.some(assignment => assignment.assigned_date === today);

  if (window.location.hash === "#training-calendar-panel" || hasTodayWorkout) {
    calendarPanel.open = true;
    return;
  }

  calendarPanel.open = false;
}

function renderTrainingCalendar() {
  renderWorkoutCalendarMonth();
  renderWorkoutCalendarDay();
}

function renderWorkoutCalendarMonth() {
  const calendar = document.getElementById("future-workout-list");
  if (!calendar) return;

  const visibleAssignments = workoutCalendarAssignments.filter(assignment => {
    const date = parseAssignmentDate(assignment.assigned_date);
    return date.getFullYear() === workoutCalendarMonth.getFullYear()
      && date.getMonth() === workoutCalendarMonth.getMonth();
  });
  const month = buildCalendarMonth(workoutCalendarMonth, visibleAssignments);

  calendar.innerHTML = `
    <section class="future-calendar-month">
      <div class="future-calendar-heading">
        <button class="icon-btn future-month-btn" type="button" data-workout-calendar-month="prev" aria-label="Previous month">
          ‹
        </button>
        <h4>${window.RipCityUI.text(month.label)}</h4>
        <button class="icon-btn future-month-btn" type="button" data-workout-calendar-month="next" aria-label="Next month">
          ›
        </button>
      </div>

      <div class="future-calendar-grid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `
          <span class="future-calendar-day-label">${day}</span>
        `).join("")}

        ${month.cells.map(cell => {
          if (!cell) return `<span class="future-calendar-cell is-empty"></span>`;
          const dateKey = formatLocalDate(cell.date);
          const isSelected = dateKey === selectedWorkoutDate;
          const isToday = dateKey === getTodayString();
          const firstWorkoutTitle = cell.assignments[0]?.workout?.title;

          return `
            <button
              class="future-calendar-cell ${cell.assignments.length ? "has-workout" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
              type="button"
              data-workout-calendar-date="${window.RipCityUI.attr(dateKey)}"
              aria-label="${window.RipCityUI.attr(formatCalendarAriaLabel(dateKey, cell.assignments.length))}"
            >
              <span class="future-calendar-date">${cell.day}</span>
              ${cell.assignments.length ? `
                <span class="future-calendar-workout">
                  ${window.RipCityUI.text(firstWorkoutTitle, "Workout")}
                </span>
              ` : ""}
            </button>
          `;
        }).join("")}
      </div>

      ${visibleAssignments.length ? "" : `<p class="future-calendar-empty">No assigned workouts this month.</p>`}
    </section>
  `;

  document.querySelectorAll("[data-workout-calendar-month]").forEach(button => {
    button.addEventListener("click", () => changeWorkoutCalendarMonth(button.dataset.workoutCalendarMonth));
  });

  document.querySelectorAll("[data-workout-calendar-date]").forEach(button => {
    button.addEventListener("click", () => {
      selectedWorkoutDate = button.dataset.workoutCalendarDate;
      renderTrainingCalendar();
    });
  });
}

function renderWorkoutCalendarDay() {
  const list = document.getElementById("workout-history-list");
  const heading = document.getElementById("training-calendar-selected-date");
  if (!list) return;

  const selectedAssignments = workoutCalendarAssignments
    .filter(assignment => assignment.assigned_date === selectedWorkoutDate)
    .sort((a, b) => (a.workout?.title || "").localeCompare(b.workout?.title || ""));
  const dateLabel = window.RipCityWorkoutData.formatDateLabel(selectedWorkoutDate);

  if (heading) {
    heading.textContent = dateLabel;
  }

  if (!selectedAssignments.length) {
    list.innerHTML = `<div class="empty-state compact-empty-state">No workouts assigned for ${window.RipCityUI.text(dateLabel)}.</div>`;
    return;
  }

  list.innerHTML = selectedAssignments.map(assignment => renderWorkoutCalendarRow(assignment)).join("");
}

function renderWorkoutCalendarRow(assignment) {
  const workout = assignment.workout;
  const assignmentLogs = workoutCalendarLogs.filter(log => log.workout_assignment_id === assignment.id);
  const summary = window.RipCityWorkoutData.summarizeSetLogs(assignmentLogs, workout);
  const today = getTodayString();
  const isFuture = assignment.assigned_date > today;
  const isToday = assignment.assigned_date === today;
  const status = getWorkoutCalendarStatus(summary, isFuture, isToday);
  const actionLabel = isFuture ? "Preview" : isToday ? "Open Workout" : "Review";

  return `
    <article class="workout-history-card compact-workout-row">
      <div class="workout-history-main">
        <div>
          <p class="eyebrow">${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(assignment.assigned_date))}</p>
          <h4>${window.RipCityUI.text(workout?.title, "Untitled Workout")}</h4>
          <p>${window.RipCityUI.text(status)} · ${summary.completedSets}/${summary.totalSets} sets</p>
        </div>

        <a class="outline-link workout-open-link" href="workout-session.html?assignment=${window.RipCityUI.attr(assignment.id)}">
          ${window.RipCityUI.text(actionLabel)}
        </a>
      </div>
    </article>
  `;
}

function getWorkoutCalendarStatus(summary, isFuture, isToday) {
  if (isFuture) return "Scheduled";
  if (summary.isComplete) return "Complete";
  if (summary.completedSets > 0) return "In Progress";
  if (isToday) return "Ready";
  return "Not Started";
}

function formatCalendarAriaLabel(dateKey, assignmentCount) {
  const label = window.RipCityWorkoutData.formatDateLabel(dateKey);
  if (!assignmentCount) return `${label}, no workouts`;
  return `${label}, ${assignmentCount} workout${assignmentCount === 1 ? "" : "s"}`;
}

function changeWorkoutCalendarMonth(direction) {
  const nextMonth = new Date(workoutCalendarMonth);
  nextMonth.setMonth(nextMonth.getMonth() + (direction === "next" ? 1 : -1));
  workoutCalendarMonth = nextMonth;

  const selectedDate = parseAssignmentDate(selectedWorkoutDate);
  const selectedDateIsVisible = selectedDate.getFullYear() === workoutCalendarMonth.getFullYear()
    && selectedDate.getMonth() === workoutCalendarMonth.getMonth();

  if (!selectedDateIsVisible) {
    const firstAssignmentInMonth = workoutCalendarAssignments
      .filter(assignment => {
        const date = parseAssignmentDate(assignment.assigned_date);
        return date.getFullYear() === workoutCalendarMonth.getFullYear()
          && date.getMonth() === workoutCalendarMonth.getMonth();
      })
      .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date))[0];

    selectedWorkoutDate = firstAssignmentInMonth?.assigned_date || formatLocalDate(workoutCalendarMonth);
  }

  renderTrainingCalendar();
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
    const date = new Date(year, month, day);
    cells.push({
      date,
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

    setMemberTypeText(getMemberTypeLabel());
    currentMemberProfile = await getMemberProfile(currentAccess.membership.id);
    updateMemberShell();

    currentMemberGroupIds = await getCurrentMemberGroupIds(currentMemberProfile.id);
    toggleH2KModuleVisibility();

    if (currentMemberProfile.member_type === "h2k") {
      h2kHabits = await loadHabits(currentAccess.membership.facility_id);
    }

    await loadTodayAssignedWorkouts();
    await loadWorkoutHistory();
    await loadMemberWeeklyHistory();

    if (currentMemberProfile.member_type === "h2k") {
      await refreshH2KDashboard();
    }

    setActiveMemberNav(window.location.hash);
    scrollMemberHashIntoView();
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

  document
    .getElementById("member-history-prev-week")
    ?.addEventListener("click", () => changeMemberHistoryWeek("previous"));
  document
    .getElementById("member-history-next-week")
    ?.addEventListener("click", () => changeMemberHistoryWeek("next"));
  document.getElementById("h2k-logout-btn")?.addEventListener("click", logoutH2K);
});
