// =====================================================
// COACH DASHBOARD
// =====================================================
// This page gives coaches/admins a quick view of H2K
// habit tracking across approved members.

let coachAccess = null;
let coachHabits = [];
let coachWorkoutReviewRows = [];

const COACH_WORKOUT_ASSIGNMENT_SELECT = `
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
        input_type,
        exercise_order
      )
    )
  )
`;

// Gets today's date in YYYY-MM-DD format.
function formatLocalDate(date) {
  // Habit logs are stored as date-only values, so we keep everything on the
  // coach's local calendar day instead of UTC.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatLocalDate(new Date());
}

// Gets Monday of current week.
function getStartOfWeekDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.getFullYear(), today.getMonth(), diff);
}

function getStartOfWeekString() {
  return formatLocalDate(getStartOfWeekDate());
}

// Gets Sunday of current week.
function getEndOfWeekString() {
  const start = getStartOfWeekDate();
  start.setDate(start.getDate() + 6);
  return formatLocalDate(start);
}

function showCoachDashboardMessage(message, isError = false) {
  const element = document.getElementById("coach-dashboard-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function showCoachWorkoutReviewMessage(message, isError = false) {
  const element = document.getElementById("coach-workout-review-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

// Gets the current logged-in user.
async function getCurrentSession() {
  return window.RipCityAccess.getSession();
}

// Gets the current user's profile and facility membership.
async function getCurrentUserProfile(userId) {
  return window.RipCityAccess.getProfileWithMemberships(userId);
}

// Protects this page so only approved coaches/admins can view it.
async function requireCoachOrAdminForDashboard() {
  return window.RipCityAccess.requireCoachAccess({
    onDeniedMessage: showCoachDashboardMessage
  });
}

// Loads the active H2K habits for the facility.
// This tells us the daily max score.
async function loadCoachHabits(facilityId) {
  const { data, error } = await db
    .from("habits")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

// Loads approved H2K members and their profile info.
async function loadApprovedH2KMembers(facilityId) {
  // This page is H2K-specific for now. Later, the same shape can be expanded
  // for athletes once workout completion and progress metrics are visible.
  const { data, error } = await db
    .from("facility_members")
    .select(`
      id,
      role,
      status,
      profile:profiles!facility_members_profile_id_fkey (
        id,
        full_name,
        email
      ),
      member_profile:member_profiles (
        id,
        member_type,
        age_group,
        body_weight
      )
    `)
    .eq("facility_id", facilityId)
    .eq("role", "h2k_member")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

// Loads habit logs for the current week for all H2K members.
async function loadHabitLogsForMembers(memberProfileIds) {
  if (!memberProfileIds.length) return [];

  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .in("member_profile_id", memberProfileIds)
    .gte("log_date", getStartOfWeekString())
    .lte("log_date", getEndOfWeekString());

  if (error) throw error;

  return data || [];
}

// Calculates each member's today and weekly score.
function buildMemberScoreRows(members, logs) {
  const today = getTodayString();

  return members.map(member => {
    // Supabase may return one-to-one joined rows as either an object or array
    // depending on relationship metadata, so normalize before scoring.
    const memberProfile = Array.isArray(member.member_profile)
      ? member.member_profile[0]
      : member.member_profile;

    const memberProfileId = memberProfile?.id;

    const memberLogs = logs.filter(log => log.member_profile_id === memberProfileId);
    const todayLogs = memberLogs.filter(log => log.log_date === today);

    const todayScore = todayLogs
      .filter(log => log.completed)
      .reduce((total, log) => total + Number(log.points_earned || 0), 0);

    const weeklyScore = memberLogs
      .filter(log => log.completed)
      .reduce((total, log) => total + Number(log.points_earned || 0), 0);

    const maxDailyScore = coachHabits.length;
    const maxWeeklyScore = coachHabits.length * 7;

    return {
      facilityMemberId: member.id,
      memberProfileId,
      name: member.profile?.full_name || "Unnamed Member",
      email: member.profile?.email || "",
      todayScore,
      weeklyScore,
      maxDailyScore,
      maxWeeklyScore,
      loggedToday: todayLogs.some(log => log.completed),
      perfectToday: maxDailyScore > 0 && todayScore === maxDailyScore
    };
  });
}

// Updates the top stat cards.
function updateCoachStats(rows) {
  // These four numbers power the top stat cards on coach-dashboard.html.
  const totalMembers = rows.length;
  const loggedToday = rows.filter(row => row.loggedToday).length;
  const perfectToday = rows.filter(row => row.perfectToday).length;
  const needsAttention = rows.filter(row => !row.loggedToday).length;

  document.getElementById("coach-total-members").textContent = totalMembers;
  document.getElementById("coach-logged-today").textContent = loggedToday;
  document.getElementById("coach-perfect-today").textContent = perfectToday;
  document.getElementById("coach-needs-attention").textContent = needsAttention;
}

// Renders coach member cards.
function renderCoachMemberList(rows) {
  const list = document.getElementById("coach-member-list");

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty-state">
        No approved H2K members found yet.
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(row => {
    // The weekly bar is a quick visual read of H2K consistency this week.
    const weeklyPercent = row.maxWeeklyScore > 0
      ? Math.round((row.weeklyScore / row.maxWeeklyScore) * 100)
      : 0;

    let statusText = "Needs Check-In";

    if (row.perfectToday) {
      statusText = "Perfect Today";
    } else if (row.loggedToday) {
      statusText = "Logged Today";
    }

    return `
      <article class="coach-member-card">
        <div>
          <h4>${window.RipCityUI.text(row.name)}</h4>
          <p>${window.RipCityUI.text(row.email)}</p>
        </div>

        <div class="coach-score-grid">
          <div>
            <span>Today</span>
            <strong>${row.todayScore}/${row.maxDailyScore}</strong>
          </div>

          <div>
            <span>Week</span>
            <strong>${row.weeklyScore}/${row.maxWeeklyScore}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>${window.RipCityUI.text(statusText)}</strong>
          </div>
        </div>

        <div class="progress-bar coach-progress-bar">
          <div style="width: ${window.RipCityUI.percent(weeklyPercent)}%"></div>
        </div>
      </article>
    `;
  }).join("");
}

// =====================================================
// COACH WORKOUT REVIEW
// =====================================================

async function loadApprovedFacilityMembers(facilityId) {
  const { data, error } = await db
    .from("facility_members")
    .select(`
      id,
      role,
      status,
      profile:profiles!facility_members_profile_id_fkey (
        id,
        full_name,
        email
      ),
      member_profile:member_profiles (
        id,
        member_type,
        sport,
        age_group
      )
    `)
    .eq("facility_id", facilityId)
    .in("role", ["athlete", "h2k_member"])
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(member => {
    const memberProfile = window.RipCityWorkoutData.normalizeJoinedOne(member.member_profile);

    return {
      facilityMemberId: member.id,
      memberProfileId: memberProfile?.id,
      memberType: memberProfile?.member_type || member.role,
      name: member.profile?.full_name || "Unnamed Member",
      email: member.profile?.email || "",
      sport: memberProfile?.sport || "",
      ageGroup: memberProfile?.age_group || ""
    };
  }).filter(member => member.memberProfileId);
}

async function loadFacilityGroupMemberships(memberProfileIds) {
  if (!memberProfileIds.length) return [];

  const { data, error } = await db
    .from("group_members")
    .select("group_id, member_profile_id")
    .in("member_profile_id", memberProfileIds);

  if (error) throw error;

  return data || [];
}

async function loadRecentWorkoutAssignmentsForCoach(facilityId) {
  const { data, error } = await db
    .from("workout_assignments")
    .select(COACH_WORKOUT_ASSIGNMENT_SELECT)
    .lte("assigned_date", getTodayString())
    .order("assigned_date", { ascending: false })
    .limit(15);

  if (error) throw error;

  return (data || []).filter(assignment => assignment.workout?.facility_id === facilityId);
}

function getAssignedMembersForWorkout(assignment, members, groupMemberships, facilityId) {
  if (assignment.target_type === "facility" && assignment.target_facility_id === facilityId) {
    return members;
  }

  if (assignment.target_type === "member") {
    return members.filter(member => member.memberProfileId === assignment.target_member_profile_id);
  }

  if (assignment.target_type === "group") {
    const memberIdsInGroup = new Set(
      groupMemberships
        .filter(row => row.group_id === assignment.target_group_id)
        .map(row => row.member_profile_id)
    );

    return members.filter(member => memberIdsInGroup.has(member.memberProfileId));
  }

  return [];
}

function buildCoachWorkoutReviewRows(assignments, members, groupMemberships, logs, facilityId) {
  return assignments.map(assignment => {
    // Assignment targets are intentionally expanded on the client for the MVP.
    // Future analytics can move this into a view/RPC once RLS is enabled.
    const assignedMembers = getAssignedMembersForWorkout(
      assignment,
      members,
      groupMemberships,
      facilityId
    );

    const memberRows = assignedMembers.map(member => {
      const memberLogs = logs.filter(log =>
        log.workout_assignment_id === assignment.id &&
        log.member_profile_id === member.memberProfileId
      );
      const summary = window.RipCityWorkoutData.summarizeSetLogs(memberLogs, assignment.workout);

      return {
        ...member,
        assignmentId: assignment.id,
        workoutId: assignment.workout?.id,
        workoutTitle: assignment.workout?.title || "Untitled Workout",
        assignedDate: assignment.assigned_date,
        logs: memberLogs,
        summary
      };
    });

    const completedMembers = memberRows.filter(row => row.summary.isComplete).length;
    const activeMembers = memberRows.filter(row => row.summary.completedSets > 0).length;
    const latestLog = memberRows
      .map(row => row.summary.lastLoggedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

    return {
      assignment,
      workout: assignment.workout,
      assignedMembers: memberRows,
      completedMembers,
      activeMembers,
      latestLog
    };
  });
}

async function refreshCoachWorkoutReview() {
  const list = document.getElementById("coach-workout-review-list");
  if (!list || !coachAccess) return;

  showCoachWorkoutReviewMessage("Loading workout completion...");

  try {
    const facilityId = coachAccess.membership.facility_id;
    const members = await loadApprovedFacilityMembers(facilityId);
    const groupMemberships = await loadFacilityGroupMemberships(
      members.map(member => member.memberProfileId)
    );
    const assignments = await loadRecentWorkoutAssignmentsForCoach(facilityId);
    const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
      assignments.map(assignment => assignment.id)
    );

    coachWorkoutReviewRows = buildCoachWorkoutReviewRows(
      assignments,
      members,
      groupMemberships,
      logs,
      facilityId
    );

    renderCoachWorkoutReview(coachWorkoutReviewRows);
    showCoachWorkoutReviewMessage("");
  } catch (error) {
    console.error(error);
    showCoachWorkoutReviewMessage(error.message || "Could not load workout completion.", true);
    list.innerHTML = `<div class="empty-state">Could not load workout completion.</div>`;
  }
}

function renderCoachWorkoutReview(rows) {
  const list = document.getElementById("coach-workout-review-list");

  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">No assigned workouts found yet.</div>`;
    return;
  }

  list.innerHTML = rows.map((row, rowIndex) => {
    const memberCount = row.assignedMembers.length;
    const completionPercent = memberCount
      ? Math.round((row.completedMembers / memberCount) * 100)
      : 0;

    return `
      <article class="coach-workout-review-card">
        <div class="coach-workout-review-header">
          <div>
            <p class="eyebrow">${row.workout?.focus || "Workout"}</p>
            <h4>${window.RipCityUI.text(row.workout?.title, "Untitled Workout")}</h4>
            <p>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(row.assignment.assigned_date))} · ${window.RipCityUI.text(formatAssignmentTarget(row.assignment))}</p>
          </div>

          <div class="coach-workout-review-summary">
            <span><strong>${row.completedMembers}/${memberCount}</strong> Complete</span>
            <span><strong>${row.activeMembers}</strong> Started</span>
            <span><strong>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateTimeLabel(row.latestLog))}</strong> Latest</span>
          </div>
        </div>

        <div class="progress-bar coach-workout-progress">
          <div style="width: ${window.RipCityUI.percent(completionPercent)}%"></div>
        </div>

        <div class="coach-workout-member-table">
          ${row.assignedMembers.map(member => renderCoachWorkoutMemberRow(member, rowIndex)).join("")}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-review-row][data-member-id]").forEach(button => {
    button.addEventListener("click", () => {
      const rowIndex = Number(button.dataset.reviewRow);
      const memberProfileId = button.dataset.memberId;
      openCoachWorkoutDetail(rowIndex, memberProfileId);
    });
  });
}

function renderCoachWorkoutMemberRow(member, rowIndex) {
  const status = member.summary.isComplete
    ? "Complete"
    : member.summary.completedSets > 0
      ? "In Progress"
      : "Not Started";

  return `
    <div class="coach-workout-member-row">
      <div>
        <strong>${window.RipCityUI.text(member.name)}</strong>
        <span>${window.RipCityUI.text(member.memberType)} ${member.sport ? `· ${window.RipCityUI.text(member.sport)}` : ""}</span>
      </div>

      <span>${window.RipCityUI.text(status)}</span>
      <span>${member.summary.completedSets}/${member.summary.totalSets} sets</span>
      <span>${member.summary.completionPercent}%</span>
      <span>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateTimeLabel(member.summary.lastLoggedAt))}</span>
      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-review-row="${window.RipCityUI.attr(rowIndex)}"
        data-member-id="${window.RipCityUI.attr(member.memberProfileId)}"
      >
        Details
      </button>
    </div>
  `;
}

function formatAssignmentTarget(assignment) {
  if (assignment.target_type === "facility") return "Facility assignment";
  if (assignment.target_type === "group") return "Group assignment";
  if (assignment.target_type === "member") return "Individual assignment";
  return "Assignment";
}

function openCoachWorkoutDetail(rowIndex, memberProfileId) {
  const detail = document.getElementById("coach-workout-detail");
  const reviewRow = coachWorkoutReviewRows[rowIndex];
  const member = reviewRow?.assignedMembers.find(row => row.memberProfileId === memberProfileId);

  if (!detail || !reviewRow || !member) return;

  const exercises = window.RipCityWorkoutData.getWorkoutExercises(reviewRow.workout);

  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="coach-workout-detail-heading">
      <div>
        <p class="eyebrow">MEMBER RESULTS</p>
        <h4>${window.RipCityUI.text(member.name)}</h4>
        <p>${window.RipCityUI.text(reviewRow.workout?.title, "Workout")} · ${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(reviewRow.assignment.assigned_date))}</p>
      </div>
      <button class="outline-btn" id="close-workout-detail-btn" type="button">Close</button>
    </div>

    <div class="coach-workout-detail-list">
      ${exercises.map(exercise => renderCoachExerciseResult(exercise, member.logs)).join("")}
    </div>
  `;

  document.getElementById("close-workout-detail-btn")?.addEventListener("click", () => {
    detail.classList.add("hidden");
    detail.innerHTML = "";
  });

  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCoachExerciseResult(exercise, logs) {
  const setCount = Number(exercise.sets || 1);
  const rows = [];

  for (let setNumber = 1; setNumber <= setCount; setNumber++) {
    const log = logs.find(item =>
      item.exercise_id === exercise.id &&
      Number(item.set_number) === setNumber
    );

    rows.push(`
      <div class="coach-set-result-row ${log?.completed ? "complete" : ""}">
        <strong>Set ${setNumber}</strong>
        <span>${log?.completed ? "Complete" : "Missing"}</span>
        <span>${formatSetActuals(log)}</span>
        <span>${log?.difficulty_rating ? `${log.difficulty_rating}/10` : "No RPE"}</span>
      </div>
    `);
  }

  return `
    <article class="coach-exercise-result-card">
      <div>
        <h5>${window.RipCityUI.text(exercise.name)}</h5>
        <p>${window.RipCityUI.text(exercise.sets || 1)} x ${window.RipCityUI.text(exercise.reps || "complete")} · ${window.RipCityUI.text(exercise.input_type)}</p>
      </div>
      <div class="coach-set-result-list">${rows.join("")}</div>
    </article>
  `;
}

function formatSetActuals(log) {
  if (!log) return "No result";

  const parts = [
    log.weight !== null ? `${log.weight} lb` : "",
    log.reps_completed !== null ? `${log.reps_completed} reps` : "",
    log.band_color || "",
    log.time_value || "",
    log.distance_value || "",
    log.athlete_note || ""
  ].filter(Boolean);

  return window.RipCityUI.text(parts.join(" · ") || "Completed");
}

// Loads everything for the coach dashboard.
async function refreshCoachDashboard() {
  showCoachDashboardMessage("Loading coach dashboard...");

  try {
    // Load habits first because their count defines the daily/weekly max score.
    coachHabits = await loadCoachHabits(coachAccess.membership.facility_id);

    const members = await loadApprovedH2KMembers(coachAccess.membership.facility_id);

    const memberProfileIds = members
      .map(member => {
        const memberProfile = Array.isArray(member.member_profile)
          ? member.member_profile[0]
          : member.member_profile;

        return memberProfile?.id;
      })
      .filter(Boolean);

    const logs = await loadHabitLogsForMembers(memberProfileIds);
    const rows = buildMemberScoreRows(members, logs);

    updateCoachStats(rows);
    renderCoachMemberList(rows);
    await refreshCoachWorkoutReview();

    showCoachDashboardMessage("");
  } catch (error) {
    console.error(error);
    showCoachDashboardMessage(error.message || "Could not load coach dashboard.", true);
  }
}

// Logs out the coach/admin.
async function logoutCoachDashboard() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

// Starts the page.
async function initCoachDashboard() {
  showCoachDashboardMessage("Checking access...");

  try {
    coachAccess = await requireCoachOrAdminForDashboard();

    if (!coachAccess) return;

    await refreshCoachDashboard();
  } catch (error) {
    console.error(error);
    showCoachDashboardMessage(error.message || "Could not open coach dashboard.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachDashboard();

  document
    .getElementById("refresh-coach-dashboard-btn")
    .addEventListener("click", refreshCoachDashboard);

  document
    .getElementById("refresh-workout-review-btn")
    ?.addEventListener("click", refreshCoachWorkoutReview);

  document
    .getElementById("coach-logout-btn")
    .addEventListener("click", logoutCoachDashboard);
});
