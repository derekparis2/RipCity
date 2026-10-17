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
let selectedHabitDate = getTodayString();
let memberHistoryWeeks = [];
let memberHistoryLogs = [];
let selectedMemberHistoryWeekIndex = 0;
let memberGoals = [];
let goalCheckinsByGoalId = {};

const MEMBER_WEEKLY_HISTORY_WEEKS = 8;

function setMemberText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

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
        is_unilateral,
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
function getStartOfWeekDate(anchorDate = new Date()) {
  const day = anchorDate.getDay();
  const diff = anchorDate.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), diff);
}

function getStartOfWeekString(anchorDate = new Date()) {
  return formatLocalDate(getStartOfWeekDate(anchorDate));
}

function getEndOfWeekString(anchorDate = new Date()) {
  const start = getStartOfWeekDate(anchorDate);
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

function formatShortDateLabel(dateKey) {
  const date = parseAssignmentDate(dateKey);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function isTodayDate(dateKey) {
  return dateKey === getTodayString();
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

function showMemberGoalsMessage(message, isError = false) {
  const element = document.getElementById("member-goals-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function normalizeGoalNumber(value) {
  return value === "" ? null : Number(value);
}

function formatGoalDate(dateKey) {
  if (!dateKey) return "No due date";

  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatGoalTimeline(timeline) {
  return {
    short_term: "Short term",
    medium_term: "Medium term",
    long_term: "Long term",
    ongoing: "Ongoing"
  }[timeline] || "Short term";
}

function formatGoalDateRange(goal) {
  const startDate = formatGoalTimestamp(goal.created_at);
  const endDate = goal.status === "completed" && goal.completed_at
    ? formatGoalTimestamp(goal.completed_at)
    : formatGoalDate(goal.due_date);
  return `${startDate} – ${endDate}`;
}

async function loadGoalCheckins() {
  if (!currentMemberProfile) return;

  const { data, error } = await db
    .from("goal_checkins")
    .select("*")
    .eq("member_profile_id", currentMemberProfile.id)
    .order("recorded_date", { ascending: true });

  if (error) throw error;

  goalCheckinsByGoalId = {};
  (data || []).forEach(checkin => {
    if (!goalCheckinsByGoalId[checkin.goal_id]) {
      goalCheckinsByGoalId[checkin.goal_id] = [];
    }
    goalCheckinsByGoalId[checkin.goal_id].push(checkin);
  });
}

async function loadMemberGoals() {
  if (!currentMemberProfile) return;

  showMemberGoalsMessage("Loading goals...");
  const { data, error } = await db
    .from("goals")
    .select("*")
    .eq("member_profile_id", currentMemberProfile.id)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  memberGoals = data || [];
  await loadGoalCheckins();
  renderMemberGoals();
  showMemberGoalsMessage("");
}

function renderGoalChart(goal) {
  const checkins = (goalCheckinsByGoalId[goal.id] || []).slice().sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
  const targetValue = goal.target_value === null ? null : Number(goal.target_value);
  const startValue = goal.current_value === null || goal.current_value === undefined ? null : Number(goal.current_value);
  const startDate = (goal.created_at || checkins[0]?.recorded_date || getTodayString()).slice(0, 10);

  // The chart should begin at the goal's starting value, then track each check-in after it.
  const points = [];
  if (startValue !== null && (!checkins.length || checkins[0].recorded_date > startDate)) {
    points.push({ recorded_date: startDate, value: startValue });
  }
  points.push(...checkins);

  if (!points.length) {
    return `<div class="empty-state compact">No check-ins yet.</div>`;
  }

  const values = points.map(point => Number(point.value));
  const allValues = targetValue === null ? values : [...values, targetValue];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = Math.max(rawMax - rawMin, 1);
  const axisPadding = range * 0.15;
  const minValue = rawMin - axisPadding;
  const maxValue = rawMax + axisPadding;
  const valueRange = Math.max(maxValue - minValue, 1);

  const leftPadding = 46;
  const rightPadding = 16;
  const topPadding = 20;
  const bottomPadding = 34;
  const width = 760;
  const height = 190;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const latestValue = values[values.length - 1];

  const xFor = index => leftPadding + (points.length === 1 ? chartWidth / 2 : (index * chartWidth) / (points.length - 1));
  const yFor = value => topPadding + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  const targetY = targetValue === null ? null : yFor(targetValue);

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(Number(point.value))}`).join(" ");

  const dots = points.map((point, index) => {
    const x = xFor(index);
    const y = yFor(Number(point.value));
    return `
      <circle cx="${x}" cy="${y}" r="4" fill="#2d6cdf"><title>${formatGoalDate(point.recorded_date)}: ${point.value}</title></circle>
      <text x="${x}" y="${Math.max(y - 10, 12)}" text-anchor="middle" class="goal-chart-value-label">${point.value}</text>
    `;
  }).join("");

  const dateLabels = points.map((point, index) => {
    const labelStep = Math.max(1, Math.ceil(points.length / 6));
    if (index % labelStep !== 0 && index !== points.length - 1) return "";

    const x = xFor(index);
    const label = new Date(`${point.recorded_date}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
    return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="goal-chart-date-label">${label}</text>`;
  }).join("");

  const yTickCount = 4;
  const yAxis = Array.from({ length: yTickCount + 1 }, (_, i) => minValue + (valueRange * i) / yTickCount).map(tick => {
    const y = yFor(tick);
    return `
      <line x1="${leftPadding}" y1="${y}" x2="${width - rightPadding}" y2="${y}" class="goal-chart-grid-line"></line>
      <text x="${leftPadding - 8}" y="${y + 3}" text-anchor="end" class="goal-chart-axis-label">${Math.round(tick * 10) / 10}</text>
    `;
  }).join("");

  return `
    <div class="goal-chart-wrap">
      ${targetValue === null ? "" : `<div class="goal-chart-summary"><span>Latest ${latestValue}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</span><span>Target ${targetValue}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</span></div>`}
      <svg viewBox="0 0 ${width} ${height}" class="goal-chart" role="img" aria-label="Goal progress chart">
        ${yAxis}
        ${targetY === null ? "" : `<line x1="${leftPadding}" y1="${targetY}" x2="${width - rightPadding}" y2="${targetY}" class="goal-chart-target-line"></line><text x="${width - rightPadding}" y="${Math.max(targetY - 4, 10)}" text-anchor="end" class="goal-chart-target-label">Target</text>`}
        <path d="${linePath}" fill="none" stroke="#2d6cdf" stroke-width="2"></path>
        ${dots}
        ${dateLabels}
      </svg>
    </div>
  `;
}

function renderMemberGoals() {
  const activeList = document.getElementById("member-active-goal-list");
  const pausedList = document.getElementById("member-paused-goal-list");
  const completedList = document.getElementById("member-completed-goal-list");
  const pausedCount = document.getElementById("member-paused-goal-count");
  const completedCount = document.getElementById("member-completed-goal-count");
  if (!activeList || !pausedList || !completedList || !pausedCount || !completedCount) return;

  const activeGoals = memberGoals.filter(goal => goal.status === "active");
  const pausedGoals = memberGoals.filter(goal => goal.status === "paused");
  const completedGoals = memberGoals.filter(goal => goal.status === "completed");
  pausedCount.textContent = pausedGoals.length;
  completedCount.textContent = completedGoals.length;
  activeList.innerHTML = activeGoals.length
    ? activeGoals.map(renderMemberGoalCard).join("")
    : `<div class="empty-state">No active goals yet. Add one above to get started.</div>`;
  pausedList.innerHTML = pausedGoals.length
    ? pausedGoals.map(renderMemberGoalCard).join("")
    : `<div class="empty-state">Paused goals will appear here.</div>`;
  completedList.innerHTML = completedGoals.length
    ? completedGoals.map(renderMemberGoalCard).join("")
    : `<div class="empty-state">Completed goals will appear here.</div>`;

  syncMemberGoalDisclosures();

  document.querySelectorAll("[data-goal-status]").forEach(select => {
    select.addEventListener("change", () => updateMemberGoalStatus(select.dataset.goalStatus, select.value));
  });
  document.querySelectorAll("[data-edit-member-goal]").forEach(button => {
    button.addEventListener("click", () => startMemberGoalEdit(button.dataset.editMemberGoal));
  });
  document.querySelectorAll("[data-delete-member-goal]").forEach(button => {
    button.addEventListener("click", () => deleteMemberGoal(button.dataset.deleteMemberGoal));
  });
  document.querySelectorAll("[data-save-goal-checkin]").forEach(button => {
    button.addEventListener("click", () => saveGoalCheckin(button.dataset.saveGoalCheckin));
  });
  document.querySelectorAll("[data-update-goal-checkin]").forEach(button => {
    button.addEventListener("click", () => updateGoalCheckin(button.dataset.updateGoalCheckin));
  });
  document.querySelectorAll("[data-delete-goal-checkin]").forEach(button => {
    button.addEventListener("click", () => deleteGoalCheckin(button.dataset.deleteGoalCheckin));
  });
}

function syncMemberGoalDisclosures() {
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  document.querySelectorAll("[data-member-goal-disclosure]").forEach(disclosure => {
    disclosure.open = false;
  });

  const editor = document.getElementById("member-goal-editor");
  if (editor && !document.getElementById("member-goal-id")?.value) {
    editor.open = !isMobile;
  }
}

function renderMemberGoalCard(goal) {
  const isOwnGoal = goal.source === "member" && goal.created_by === currentAccess.session.user.id;
  const checkins = goalCheckinsByGoalId[goal.id] || [];
  const valueText = window.RipCityGoalProgress.formatGoalValueSummary(goal, checkins);
  const goalDateText = formatGoalDateRange(goal);

  return `
    <article class="member-goal-card ${goal.status === "paused" ? "is-paused" : ""}">
      <details class="member-goal-disclosure" data-member-goal-disclosure>
        <summary class="member-goal-summary">
          <div class="member-goal-summary-copy">
            <div class="member-goal-card-heading">
              <h4>${window.RipCityUI.text(goal.name)}</h4>
              <div class="member-goal-summary-badges">
                <span class="status-pill">${window.RipCityUI.text(goal.source === "coach" ? "Coach goal" : "Your goal")}</span>
                <span class="status-pill goal-status-pill is-${window.RipCityUI.attr(goal.status)}">${window.RipCityUI.text(goal.status[0].toUpperCase() + goal.status.slice(1))}</span>
              </div>
            </div>
            <div class="member-goal-meta">
              <span>${window.RipCityUI.text(valueText)}</span>
              <span>${window.RipCityUI.text(formatGoalTimeline(goal.timeline))}</span>
              <span>${window.RipCityUI.text(goalDateText)}</span>
            </div>
          </div>
          <span class="member-goal-summary-action" aria-hidden="true"></span>
        </summary>
        <div class="member-goal-expanded">
          <div class="member-goal-card-main">
            ${goal.description ? `<p>${window.RipCityUI.text(goal.description)}</p>` : ""}
            <div class="goal-checkin-chart">
              ${renderGoalChart(goal)}
            </div>
          </div>
          <div class="member-goal-actions">
            <label>
              Status
              <select data-goal-status="${window.RipCityUI.attr(goal.id)}">
                ${["active", "paused", "completed"].map(status => `<option value="${status}" ${goal.status === status ? "selected" : ""}>${status[0].toUpperCase() + status.slice(1)}</option>`).join("")}
              </select>
            </label>
            ${isCompleted ? "" : `<details class="goal-checkin-form">
              <summary>Check in</summary>
              <div class="goal-checkin-inline">
                <input type="date" data-goal-checkin-date="${window.RipCityUI.attr(goal.id)}" value="${getTodayString()}" />
                <input type="number" step="any" data-goal-checkin-value="${window.RipCityUI.attr(goal.id)}" placeholder="${window.RipCityUI.attr(goal.unit || "value")}" />
                <button class="primary-btn small-btn" type="button" data-save-goal-checkin="${window.RipCityUI.attr(goal.id)}">Add</button>
              </div>
            </details>`}
            ${isOwnGoal ? `<button class="outline-btn" type="button" data-edit-member-goal="${window.RipCityUI.attr(goal.id)}">Edit</button>` : ""}
            ${isOwnGoal ? `<button class="outline-btn danger-outline-btn" type="button" data-delete-member-goal="${window.RipCityUI.attr(goal.id)}">Delete</button>` : ""}
          </div>
          ${checkins.length ? `<details class="goal-checkin-history">
            <summary>Check-in history (${checkins.length})</summary>
            <div class="goal-checkin-history-list">
            ${checkins.map(checkin => isCompleted
              ? `<div class="goal-checkin-history-item is-read-only"><span>${window.RipCityUI.text(formatGoalDate(checkin.recorded_date))}</span><strong>${Number(checkin.value)}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</strong></div>`
              : `<div class="goal-checkin-history-item">
                <input type="date" aria-label="Check-in date" data-edit-goal-checkin-date="${window.RipCityUI.attr(checkin.id)}" value="${window.RipCityUI.attr(checkin.recorded_date)}" />
                <input type="number" aria-label="Check-in value" step="any" data-edit-goal-checkin-value="${window.RipCityUI.attr(checkin.id)}" value="${Number(checkin.value)}" />
                ${goal.unit ? `<span class="goal-checkin-unit">${window.RipCityUI.text(goal.unit)}</span>` : ""}
                <button class="outline-btn small-btn" type="button" data-update-goal-checkin="${window.RipCityUI.attr(checkin.id)}">Save</button>
                <button class="outline-btn danger-outline-btn small-btn" type="button" data-delete-goal-checkin="${window.RipCityUI.attr(checkin.id)}">Delete</button>
              </div>`).join("")}
            </div>
          </details>` : ""}
        </div>
      </details>
    </article>
  `;
}

function formatGoalTimestamp(timestamp) {
  if (!timestamp) return "Unknown date";

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function resetMemberGoalForm() {
  const form = document.getElementById("member-goal-form");
  form?.reset();
  document.getElementById("member-goal-id").value = "";
  document.getElementById("member-goal-submit").textContent = "Add Goal";
  document.getElementById("member-goal-cancel").classList.add("hidden");
  const editor = document.getElementById("member-goal-editor");
  if (editor && window.matchMedia("(max-width: 700px)").matches) editor.open = false;
}

function startMemberGoalEdit(goalId) {
  const goal = memberGoals.find(item => item.id === goalId);
  if (!goal) return;

  document.getElementById("member-goal-id").value = goal.id;
  document.getElementById("member-goal-name").value = goal.name;
  document.getElementById("member-goal-timeline").value = goal.timeline;
  document.getElementById("member-goal-current-value").value = goal.current_value ?? "";
  document.getElementById("member-goal-target-value").value = goal.target_value ?? "";
  document.getElementById("member-goal-unit").value = goal.unit || "";
  document.getElementById("member-goal-due-date").value = goal.due_date || "";
  document.getElementById("member-goal-description").value = goal.description || "";
  document.getElementById("member-goal-submit").textContent = "Save Goal";
  document.getElementById("member-goal-cancel").classList.remove("hidden");
  document.getElementById("member-goal-editor").open = true;
  document.getElementById("member-goal-name").focus();
}

async function saveMemberGoal(event) {
  event.preventDefault();
  if (!currentMemberProfile) return;

  const goalId = document.getElementById("member-goal-id").value;
  const values = {
    name: document.getElementById("member-goal-name").value.trim(),
    description: document.getElementById("member-goal-description").value.trim() || null,
    timeline: document.getElementById("member-goal-timeline").value,
    current_value: normalizeGoalNumber(document.getElementById("member-goal-current-value").value),
    target_value: normalizeGoalNumber(document.getElementById("member-goal-target-value").value),
    unit: document.getElementById("member-goal-unit").value.trim() || null,
    due_date: document.getElementById("member-goal-due-date").value || null
  };

  showMemberGoalsMessage("Saving goal...");
  try {
    const request = goalId
      ? db.from("goals").update(values).eq("id", goalId)
      : db.from("goals").insert({
        ...values,
        member_profile_id: currentMemberProfile.id,
        created_by: currentAccess.session.user.id,
        source: "member"
      });
    const { error } = await request;
    if (error) throw error;

    resetMemberGoalForm();
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not save goal.", true);
  }
}

async function updateMemberGoalStatus(goalId, status) {
  showMemberGoalsMessage("Updating goal...");
  try {
    const { error } = await db.from("goals").update({ status }).eq("id", goalId);
    if (error) throw error;
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not update goal status.", true);
  }
}

async function deleteMemberGoal(goalId) {
  if (!window.confirm("Delete this goal permanently? This cannot be undone.")) return;

  showMemberGoalsMessage("Deleting goal...");
  try {
    const { error } = await db.from("goals").delete().eq("id", goalId);
    if (error) throw error;
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not delete goal.", true);
  }
}

async function saveGoalCheckin(goalId) {
  const dateInput = document.querySelector(`[data-goal-checkin-date="${goalId}"]`);
  const valueInput = document.querySelector(`[data-goal-checkin-value="${goalId}"]`);
  if (!dateInput || !valueInput) return;

  const recordedDate = dateInput.value;
  const rawValue = valueInput.value;
  const value = Number(rawValue);
  if (!recordedDate || rawValue === "" || Number.isNaN(value)) {
    showMemberGoalsMessage("Choose a date and enter a numeric goal value.", true);
    return;
  }

  showMemberGoalsMessage("Saving check-in...");
  try {
    const { error } = await db.from("goal_checkins").insert({
      goal_id: goalId,
      member_profile_id: currentMemberProfile.id,
      recorded_date: recordedDate,
      value,
      created_by: currentAccess.session.user.id
    });

    if (error) throw error;
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not save goal check-in.", true);
  }
}

async function updateGoalCheckin(checkinId) {
  const dateInput = document.querySelector(`[data-edit-goal-checkin-date="${checkinId}"]`);
  const valueInput = document.querySelector(`[data-edit-goal-checkin-value="${checkinId}"]`);
  if (!dateInput || !valueInput) return;

  const recordedDate = dateInput.value;
  const value = Number(valueInput.value);
  if (!recordedDate || valueInput.value.trim() === "" || Number.isNaN(value)) {
    showMemberGoalsMessage("Choose a date and enter a numeric goal value.", true);
    return;
  }

  showMemberGoalsMessage("Updating check-in...");
  try {
    const { error } = await db.from("goal_checkins")
      .update({ recorded_date: recordedDate, value })
      .eq("id", checkinId);
    if (error) throw error;
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not update goal check-in.", true);
  }
}

async function deleteGoalCheckin(checkinId) {
  if (!window.confirm("Delete this check-in?")) return;

  showMemberGoalsMessage("Deleting check-in...");
  try {
    const { error } = await db.from("goal_checkins").delete().eq("id", checkinId);
    if (error) throw error;
    await loadMemberGoals();
  } catch (error) {
    console.error(error);
    showMemberGoalsMessage(error.message || "Could not delete goal check-in.", true);
  }
}

// Loads habit logs for the selected dashboard date.
async function loadHabitLogsForDate(memberProfileId, dateKey = selectedHabitDate) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .eq("log_date", dateKey);

  if (error) throw error;
  return data || [];
}

async function loadWeeklyLogs(memberProfileId, anchorDate = new Date()) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .gte("log_date", getStartOfWeekString(anchorDate))
    .lte("log_date", getEndOfWeekString(anchorDate));

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

// Checks if a habit has already been completed for the selected habit date.
function isHabitCompleteForSelectedDate(habitId) {
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
  setMemberText("member-program-label", memberType);
  setMemberText("member-sidebar-role", memberType);

  const brandSubtitle = document.getElementById("member-brand-subtitle");
  if (brandSubtitle) {
    brandSubtitle.textContent = memberType;
  }

  document.querySelectorAll(".member-role-pending").forEach(element => {
    element.classList.remove("member-role-pending");
  });
}

function updateMemberShell() {
  const profile = currentAccess?.profile;
  const memberType = getMemberTypeLabel();
  const bandBadge = document.getElementById("member-band-color");
  const bandColor = currentMemberProfile?.h2k_band_color;

  setMemberTypeText(memberType);
  setMemberText("member-sidebar-name", profile?.full_name || "Member");
  setMemberText(
    "member-history-link-detail",
    currentMemberProfile?.member_type === "h2k"
      ? "Review weekly training and H2K results."
      : "Review your weekly workout completion."
  );

  const avatar = document.getElementById("member-avatar");
  if (avatar && profile?.profile_picture_url) {
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
  } else if (avatar) {
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
  setMemberText("member-dashboard-date", dateLabel);
}

function setupFeedbackLink() {
  const link = document.getElementById("member-feedback-link");
  if (!link) return;

  // The temporary dashboard feedback link shares its Google Form destination
  // with the coach dashboard through js/shared/ui-utils.js.
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

function updateHabitDateControls() {
  const dateInput = document.getElementById("habit-date-input");
  const eyebrow = document.getElementById("h2k-habit-date-eyebrow");
  const detail = document.getElementById("h2k-habit-date-detail");
  const todayButton = document.getElementById("habit-today-btn");
  const nextButton = document.getElementById("habit-next-day-btn");
  const selectedDateIsToday = isTodayDate(selectedHabitDate);
  const selectedDateLabel = formatShortDateLabel(selectedHabitDate);

  if (dateInput) {
    dateInput.value = selectedHabitDate;
    dateInput.max = getTodayString();
  }

  if (eyebrow) {
    eyebrow.textContent = selectedDateIsToday
      ? "TODAY"
      : selectedDateLabel.toUpperCase();
  }

  if (detail) {
    detail.textContent = selectedDateIsToday
      ? "Editing today"
      : `Editing ${selectedDateLabel}`;
  }

  if (todayButton) {
    todayButton.disabled = selectedDateIsToday;
  }

  if (nextButton) {
    nextButton.disabled = selectedDateIsToday;
  }
}

async function setHabitDate(dateKey) {
  if (!currentMemberProfile || currentMemberProfile.member_type !== "h2k") return;

  const today = getTodayString();
  selectedHabitDate = dateKey > today ? today : dateKey;
  updateHabitDateControls();
  await refreshH2KDashboard();
}

function setupHabitDateControls() {
  const dateInput = document.getElementById("habit-date-input");
  const previousButton = document.getElementById("habit-prev-day-btn");
  const nextButton = document.getElementById("habit-next-day-btn");
  const todayButton = document.getElementById("habit-today-btn");

  dateInput?.addEventListener("change", () => {
    if (dateInput.value) setHabitDate(dateInput.value);
  });

  previousButton?.addEventListener("click", () => {
    setHabitDate(formatLocalDate(addDays(parseAssignmentDate(selectedHabitDate), -1)));
  });

  nextButton?.addEventListener("click", () => {
    setHabitDate(formatLocalDate(addDays(parseAssignmentDate(selectedHabitDate), 1)));
  });

  todayButton?.addEventListener("click", () => {
    setHabitDate(getTodayString());
  });

  updateHabitDateControls();
}

// Renders the list of six habits as checkable cards.
function renderHabitCards() {
  const list = document.getElementById("h2k-habit-list");
  if (!list) return;

  if (!h2kHabits.length) {
    list.innerHTML = `<div class="empty-state">No habits found.</div>`;
    return;
  }

  list.innerHTML = h2kHabits.map(habit => {
    const completed = isHabitCompleteForSelectedDate(habit.id);

    return `
      <article class="h2k-habit-card ${completed ? "complete" : ""}">
        <div>
          <h4>${window.RipCityUI.text(habit.name)}</h4>
          <p>${window.RipCityUI.text(habit.description, "Complete this habit for the selected date.")}</p>
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

// Saves or updates a habit log for the selected habit date.
// If checked, completed = true and points_earned = 1.
// If unchecked, completed = false and points_earned = 0.
async function toggleHabit(habitId) {
  const completedNow = !isHabitCompleteForSelectedDate(habitId);

  showH2KMessage("Saving habit...");

  try {
    const { error } = await db
      .from("habit_logs")
      .upsert(
        {
          member_profile_id: currentMemberProfile.id,
          habit_id: habitId,
          log_date: selectedHabitDate,
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
  const todayKey = getTodayString();
  const { data: allLogs, error } = await db
    .from("habit_logs")
    .select("habit_id, log_date, completed, points_earned")
    .eq("member_profile_id", currentMemberProfile.id)
    .lte("log_date", todayKey);

  if (error) throw error;

  const metrics = window.RipCityMetrics.calculateH2KMetrics({
    logs: allLogs || [],
    habitCount: h2kHabits.length || 6,
    todayKey
  });

  setMemberText("today-score", metrics.todayScore);
  setMemberText("weekly-score-h2k", metrics.fourWeekAverage ?? "No history");
  setMemberText("weekly-percent-h2k", metrics.currentStreak);
  setMemberText("h2k-status", `${metrics.currentWeekScore}/${metrics.currentWeekMax}`);
  setMemberText("member-stat-one-suffix", `/${h2kHabits.length}`);
  setMemberText("member-stat-two-suffix", metrics.fourWeekAverage === null
    ? ""
    : `/${metrics.fourWeekMax}`);
  setMemberText("member-stat-three-suffix", " days");
  setMemberText("member-stat-one-label", "Today’s Score");
  setMemberText("member-stat-one-detail", "Habits completed today");
  setMemberText("member-stat-two-label", "4-Week Average");
  setMemberText("member-stat-two-detail", metrics.fourWeekAverage === null
    ? "Complete a full week to start your average"
    : "Previous four completed weeks");
  setMemberText("member-stat-three-label", "Current Streak");
  setMemberText("member-stat-three-detail", "4+ habits completed per day");
  setMemberText("member-stat-four-label", "Current Week");
  setMemberText("h2k-status-detail", `${metrics.currentWeekQualifiedDays} qualified day${metrics.currentWeekQualifiedDays === 1 ? "" : "s"} · ${metrics.currentWeekMax} possible points`);
}

// Reloads selected-date logs, re-renders cards, and updates scores.
async function refreshH2KDashboard() {
  // Habits and status are refreshed together so the dashboard state matches
  // the checkmark cards below.
  todayLogs = await loadHabitLogsForDate(currentMemberProfile.id, selectedHabitDate);
  updateHabitDateControls();
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
  const statsSection = document.getElementById("member-stats-section");
  const trainingProgressCard = document.getElementById("member-training-progress-card");

  document.body.classList.toggle("member-type-h2k", isH2K);
  document.body.classList.toggle("member-type-athlete", !isH2K);

  if (statsSection) {
    statsSection.classList.remove("hidden");
  }

  if (trainingProgressCard) trainingProgressCard.classList.remove("hidden");

  if (habitsSection) {
    habitsSection.classList.toggle("hidden", !isH2K);
  }

  window.RipCityMemberNav?.setH2KVisibility(isH2K);

  if (isH2K) {
    setMemberText("member-stat-one-label", "Today’s Score");
    setMemberText("member-stat-one-detail", "Habits completed today");
    setMemberText("member-stat-two-label", "Weekly Score");
    setMemberText("member-stat-two-detail", "Possible weekly points");
    setMemberText("member-stat-one-suffix", `/${h2kHabits.length || 6}`);
    setMemberText("member-stat-two-suffix", `/${(h2kHabits.length || 6) * 7}`);
    setMemberText("member-stat-three-suffix", " days");
    return;
  }

  if (!isH2K) {
    setMemberText("member-stat-one-label", "This Week");
    setMemberText("member-stat-one-detail", "Assigned workout attendance");
    setMemberText("member-stat-two-label", "Completed This Week");
    setMemberText("member-stat-two-detail", "Completed / assigned workouts");
    setMemberText("member-stat-three-label", "4-Week Attendance");
    setMemberText("member-stat-three-detail", "Previous four completed weeks");
    setMemberText("member-stat-four-label", "Current Streak");
    setMemberText("member-stat-one-suffix", "");
    setMemberText("member-stat-two-suffix", "");
    setMemberText("member-stat-three-suffix", "");
    setMemberText("h2k-status", "Training");
    setMemberText("h2k-status-detail", "Open assigned workouts and track progress");
  }
}

function updateSharedWorkoutStats() {
  if (currentMemberProfile?.member_type === "h2k") return;

  const today = getTodayString();
  const metricAssignments = workoutCalendarAssignments
    .filter(assignment => assignment.assigned_date <= today)
    .map(assignment => {
    const logs = workoutCalendarLogs.filter(log => log.workout_assignment_id === assignment.id);
    const summary = window.RipCityWorkoutData.summarizeSetLogs(logs, assignment.workout);
    return {
      id: assignment.id,
      assigned_date: assignment.assigned_date,
      isComplete: summary.isComplete
    };
  });
  const metrics = window.RipCityMetrics.calculateAthleteMetrics({
    assignments: metricAssignments,
    todayKey: today
  });

  setMemberText("today-score", metrics.currentWeek.percent ?? "—");
  setMemberText("member-stat-one-suffix", metrics.currentWeek.percent === null ? "" : "%");
  setMemberText("weekly-score-h2k", `${metrics.currentWeek.completed}/${metrics.currentWeek.assigned}`);
  setMemberText("weekly-percent-h2k", metrics.fourWeek.percent ?? "—");
  setMemberText("member-stat-three-suffix", metrics.fourWeek.percent === null ? "" : "%");
  setMemberText("h2k-status", `${metrics.currentStreak} day${metrics.currentStreak === 1 ? "" : "s"}`);
  setMemberText("h2k-status-detail", `Longest streak: ${metrics.longestStreak} assigned workout day${metrics.longestStreak === 1 ? "" : "s"}`);
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
                        ${exercise.sets || exercise.reps ? `<span>${window.RipCityUI.text(exercise.sets || "—")} x ${window.RipCityUI.text(exercise.reps || "—")}${exercise.is_unilateral ? " each side" : ""}</span>` : ""}
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
  const stats = document.getElementById("member-stats-section");
  const weeklyHistory = document.getElementById("member-weekly-history-list");

  if ((!list && !calendar && !stats && !weeklyHistory) || !currentMemberProfile) return;

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
      .order("assigned_date", { ascending: false });

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
      if (currentMemberProfile?.member_type === "h2k" && selectedWorkoutDate <= getTodayString()) {
        setHabitDate(selectedWorkoutDate);
      }
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

// Shared startup for the member dashboard and its dedicated feature pages.
async function initMemberPage() {
  const page = document.body.dataset.memberPage || "dashboard";
  showH2KMessage("Loading member page...");

  try {
    // Startup order matters: access -> member profile -> facility habits/workouts.
    currentAccess = await getApprovedUserAccess();
    if (!currentAccess) return;

    selectedHabitDate = getTodayString();
    setMemberTypeText(getMemberTypeLabel());
    currentMemberProfile = await getMemberProfile(currentAccess.membership.id);
    updateMemberShell();

    currentMemberGroupIds = await getCurrentMemberGroupIds(currentMemberProfile.id);
    toggleH2KModuleVisibility();

    const isH2K = currentMemberProfile.member_type === "h2k";
    const needsHabits = isH2K && ["dashboard", "habits", "history"].includes(page);
    const needsWorkoutHistory = ["dashboard", "training", "history"].includes(page);

    if (needsHabits) {
      h2kHabits = await loadHabits(currentAccess.membership.facility_id);
    }

    if (page === "habits" && !isH2K) {
      window.location.replace("member-dashboard.html");
      return;
    }

    if (needsWorkoutHistory) await loadWorkoutHistory();
    if (page === "history") await loadMemberWeeklyHistory();
    if (page === "goals") await loadMemberGoals();

    if (isH2K && ["dashboard", "habits"].includes(page)) {
      await refreshH2KDashboard();
    }

    showH2KMessage("");
  } catch (error) {
    console.error(error);
    showH2KMessage(error.message || "Could not load this member page.", true);
  }
}

// Logs out the current user.
async function logoutH2K() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  setupFeedbackLink();
  setupHabitDateControls();
  document.getElementById("member-goal-form")?.addEventListener("submit", saveMemberGoal);
  document.getElementById("member-goal-cancel")?.addEventListener("click", resetMemberGoalForm);
  window.matchMedia("(max-width: 700px)").addEventListener("change", syncMemberGoalDisclosures);
  initMemberPage();

  document
    .getElementById("member-history-prev-week")
    ?.addEventListener("click", () => changeMemberHistoryWeek("previous"));
  document
    .getElementById("member-history-next-week")
    ?.addEventListener("click", () => changeMemberHistoryWeek("next"));
  document.getElementById("h2k-logout-btn")?.addEventListener("click", logoutH2K);
});
