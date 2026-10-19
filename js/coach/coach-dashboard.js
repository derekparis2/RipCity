// =====================================================
// COACH DASHBOARD
// =====================================================
// This page gives coaches/admins a quick view of H2K
// habit tracking across approved members.

let coachAccess = null;
let coachHabits = [];
let coachHistoryMembers = [];
let selectedCoachWeeklyMemberId = null;
let coachWeeklyHistoryWeeks = [];
let coachWeeklyHistoryLogs = [];
let selectedCoachWeeklyWeekIndex = 0;
let coachWorkoutReviewRows = [];
let coachReviewMembers = [];
let coachReviewGroups = [];
let coachAttentionRows = [];
let selectedCoachReviewRowIndex = null;

const COACH_WEEKLY_HISTORY_WEEKS = 12;

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
        is_unilateral,
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

function getWorkoutReviewHistoryStartString() {
  const historyStart = getStartOfWeekDate();
  historyStart.setDate(historyStart.getDate() - 28);
  return formatLocalDate(historyStart);
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
      created_at,
      role,
      status,
      profile:profiles!facility_members_profile_id_fkey (
        id,
        full_name,
        email,
        profile_picture_url
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

async function loadHabitLogsForMemberRange(memberProfileId, startDate, endDate) {
  const { data, error } = await db
    .from("habit_logs")
    .select("*")
    .eq("member_profile_id", memberProfileId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

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
      profilePictureUrl: member.profile?.profile_picture_url || "",
      todayScore,
      weeklyScore,
      maxDailyScore,
      maxWeeklyScore,
      loggedToday: todayLogs.some(log => log.completed),
      perfectToday: maxDailyScore > 0 && todayScore === maxDailyScore
    };
  });
}

function buildCoachWeeklyMemberOptionsFromApproved(members) {
  return members.map(member => ({
    facilityMemberId: member.facilityMemberId,
    memberProfileId: member.memberProfileId,
    memberType: member.memberType,
    name: member.name,
    email: member.email,
    profilePictureUrl: member.profilePictureUrl,
    searchText: `${member.name || ""} ${member.email || ""} ${member.memberType || ""}`.toLowerCase()
  })).filter(member => member.memberProfileId);
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
        <div class="coach-member-card-heading">
          ${window.RipCityUI.avatarMarkup(row.name, row.profilePictureUrl, "coach-member-avatar")}
          <div>
            <h4>${window.RipCityUI.text(row.name)}</h4>
            <p>${window.RipCityUI.text(row.email)}</p>
          </div>
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

function showCoachWeeklyHistoryMessage(message, isError = false) {
  const element = document.getElementById("coach-weekly-history-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function renderCoachWeeklyMemberResults() {
  const results = document.getElementById("coach-weekly-member-results");
  const search = document.getElementById("coach-weekly-member-search");
  const memberTypeFilter = document.getElementById("coach-weekly-member-type-filter");
  if (!results) return;

  const query = String(search?.value || "").trim().toLowerCase();
  const selectedType = memberTypeFilter?.value || "all";
  const matchingMembers = coachHistoryMembers
    .filter(member => selectedType === "all" || member.memberType === selectedType)
    .filter(member => !query || member.searchText.includes(query))
    .slice(0, 8);

  if (!coachHistoryMembers.length) {
    results.innerHTML = `<div class="empty-state">No approved members found yet.</div>`;
    return;
  }

  if (!matchingMembers.length) {
    results.innerHTML = `<div class="empty-state">No members match that search.</div>`;
    return;
  }

  results.innerHTML = matchingMembers.map(member => `
    <button
      class="coach-weekly-member-option ${member.memberProfileId === selectedCoachWeeklyMemberId ? "active" : ""}"
      type="button"
      data-coach-weekly-member-id="${window.RipCityUI.attr(member.memberProfileId)}"
    >
      ${window.RipCityUI.avatarMarkup(member.name, member.profilePictureUrl, "coach-review-avatar")}
      <span>
        <strong>${window.RipCityUI.text(member.name)}</strong>
        <small>${window.RipCityUI.text(formatMemberTypeLabel(member.memberType))} · ${window.RipCityUI.text(member.email)}</small>
      </span>
    </button>
  `).join("");

  results.querySelectorAll("[data-coach-weekly-member-id]").forEach(button => {
    button.addEventListener("click", async () => {
      selectedCoachWeeklyMemberId = button.dataset.coachWeeklyMemberId;
      renderCoachWeeklyMemberResults();
      await refreshCoachWeeklyHistory();
    });
  });
}

async function refreshCoachWeeklyHistory() {
  const list = document.getElementById("coach-weekly-history-list");
  const selectedMemberElement = document.getElementById("coach-weekly-selected-member");
  if (!list) return;

  if (!selectedCoachWeeklyMemberId && coachHistoryMembers.length) {
    selectedCoachWeeklyMemberId = coachHistoryMembers[0].memberProfileId;
  }

  const selectedMember = coachHistoryMembers.find(member =>
    member.memberProfileId === selectedCoachWeeklyMemberId
  );

  if (!selectedMember) {
    if (selectedMemberElement) {
      selectedMemberElement.textContent = "Select a member to view weekly scores.";
    }
    list.innerHTML = `<div class="empty-state">Select a member to view weekly scores.</div>`;
    return;
  }

  if (selectedMemberElement) {
    selectedMemberElement.innerHTML = `
      <span class="eyebrow">SELECTED MEMBER</span>
      <strong>${window.RipCityUI.text(selectedMember.name)}</strong>
      <small>${window.RipCityUI.text(formatMemberTypeLabel(selectedMember.memberType))} · ${window.RipCityUI.text(selectedMember.email)}</small>
    `;
  }

  showCoachWeeklyHistoryMessage("Loading weekly history...");

  try {
    coachWeeklyHistoryWeeks = buildRecentWeekRanges(COACH_WEEKLY_HISTORY_WEEKS);
    selectedCoachWeeklyWeekIndex = Math.min(
      selectedCoachWeeklyWeekIndex,
      coachWeeklyHistoryWeeks.length - 1
    );
    if (selectedMember.memberType === "h2k") {
      coachWeeklyHistoryLogs = await loadHabitLogsForMemberRange(
        selectedMember.memberProfileId,
        coachWeeklyHistoryWeeks[coachWeeklyHistoryWeeks.length - 1].startKey,
        coachWeeklyHistoryWeeks[0].endKey
      );
    } else {
      coachWeeklyHistoryLogs = await loadCoachMemberTrainingHistoryLogs(
        selectedMember,
        coachWeeklyHistoryWeeks
      );
    }

    renderCoachWeeklyHistory();
    showCoachWeeklyHistoryMessage("");
  } catch (error) {
    console.error(error);
    showCoachWeeklyHistoryMessage(error.message || "Could not load weekly history.", true);
    list.innerHTML = `<div class="empty-state">Could not load weekly history.</div>`;
  }
}

function renderCoachWeeklyHistory() {
  const list = document.getElementById("coach-weekly-history-list");
  if (!list) return;

  const week = coachWeeklyHistoryWeeks[selectedCoachWeeklyWeekIndex];
  if (!week) {
    list.innerHTML = `<div class="empty-state">No weekly scores available yet.</div>`;
    return;
  }

  updateCoachWeeklyHistoryStepper(week);

  const selectedMember = coachHistoryMembers.find(member =>
    member.memberProfileId === selectedCoachWeeklyMemberId
  );
  const row = selectedMember?.memberType === "h2k"
    ? buildWeeklyScoreRow(week, coachWeeklyHistoryLogs, coachHabits.length * 7)
    : buildCoachTrainingWeeklyScoreRow(week);

  list.innerHTML = renderWeeklyScoreCard(row);
}

async function loadCoachMemberTrainingHistoryLogs(member, weeks) {
  const facilityId = coachAccess.membership.facility_id;
  const earliestWeek = weeks[weeks.length - 1];
  const latestWeek = weeks[0];
  const groupMemberships = await loadFacilityGroupMemberships([member.memberProfileId]);
  const groupIds = groupMemberships.map(row => row.group_id);

  const { data, error } = await db
    .from("workout_assignments")
    .select(COACH_WORKOUT_ASSIGNMENT_SELECT)
    .gte("assigned_date", earliestWeek.startKey)
    .lte("assigned_date", latestWeek.endKey)
    .order("assigned_date", { ascending: false });

  if (error) throw error;

  const assignments = window.RipCityWorkoutData
    .dedupeAssignmentsByWorkoutDate((data || []).filter(assignment => {
      if (assignment.workout?.facility_id !== facilityId) return false;
      if (assignment.target_type === "facility") return assignment.target_facility_id === facilityId;
      if (assignment.target_type === "member") return assignment.target_member_profile_id === member.memberProfileId;
      if (assignment.target_type === "group") return groupIds.includes(assignment.target_group_id);
      return false;
    }));
  const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
    assignments.map(assignment => assignment.id),
    member.memberProfileId
  );

  return { assignments, logs };
}

function updateCoachWeeklyHistoryStepper(week) {
  const context = document.getElementById("coach-weekly-week-context");
  const label = document.getElementById("coach-weekly-week-label");
  const previousButton = document.getElementById("coach-weekly-prev-week");
  const nextButton = document.getElementById("coach-weekly-next-week");

  if (context) context.textContent = week.isCurrentWeek ? "CURRENT WEEK" : "WEEK";
  if (label) label.textContent = formatWeekRangeLabel(week);
  if (previousButton) previousButton.disabled = selectedCoachWeeklyWeekIndex >= coachWeeklyHistoryWeeks.length - 1;
  if (nextButton) nextButton.disabled = selectedCoachWeeklyWeekIndex <= 0;
}

function changeCoachWeeklyHistoryWeek(direction) {
  if (!coachWeeklyHistoryWeeks.length) return;

  selectedCoachWeeklyWeekIndex += direction === "previous" ? 1 : -1;
  selectedCoachWeeklyWeekIndex = Math.max(
    0,
    Math.min(selectedCoachWeeklyWeekIndex, coachWeeklyHistoryWeeks.length - 1)
  );

  renderCoachWeeklyHistory();
}

function buildWeeklyScoreRow(week, logs, maxWeeklyScore) {
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

function buildCoachTrainingWeeklyScoreRow(week) {
  const assignments = coachWeeklyHistoryLogs.assignments || [];
  const logs = coachWeeklyHistoryLogs.logs || [];
  const weekAssignments = assignments.filter(assignment =>
    assignment.assigned_date >= week.startKey &&
    assignment.assigned_date <= week.endKey &&
    assignment.assigned_date <= getTodayString()
  );
  const summaries = weekAssignments.map(assignment => {
    const assignmentLogs = logs.filter(log => log.workout_assignment_id === assignment.id);
    return window.RipCityWorkoutData.summarizeSetLogs(assignmentLogs, assignment.workout);
  });
  const completedWorkouts = summaries.filter(summary => summary.isComplete).length;
  const completedSets = summaries.reduce((total, summary) => total + summary.completedSets, 0);
  const totalSets = summaries.reduce((total, summary) => total + summary.totalSets, 0);

  return {
    label: formatWeekRangeLabel(week),
    typeLabel: "Training Week",
    score: completedWorkouts,
    maxScore: weekAssignments.length,
    percent: totalSets ? Math.round((completedSets / totalSets) * 100) : 0,
    detail: `${completedSets}/${totalSets} sets logged`,
    secondaryDetail: `${weekAssignments.length} assigned workout${weekAssignments.length === 1 ? "" : "s"}`,
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
        email,
        profile_picture_url
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
      profilePictureUrl: member.profile?.profile_picture_url || "",
      trackingStartDate: member.created_at ? member.created_at.slice(0, 10) : null,
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

async function loadCoachReviewGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("id, name, member_type, group_type")
    .eq("facility_id", facilityId)
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function loadRecentWorkoutAssignmentsForCoach(facilityId) {
  const { data, error } = await db
    .from("workout_assignments")
    .select(COACH_WORKOUT_ASSIGNMENT_SELECT)
    .gte("assigned_date", getWorkoutReviewHistoryStartString())
    .lte("assigned_date", getEndOfWeekString())
    .order("assigned_date", { ascending: false })
    .limit(300);

  if (error) throw error;

  return (data || []).filter(assignment => assignment.workout?.facility_id === facilityId);
}

function formatMemberTypeLabel(memberType) {
  return memberType === "h2k" ? "H2K" : "Athlete";
}

function getMemberCompletionStatus(member) {
  if (member.summary.isComplete) return "complete";
  if (member.summary.completedSets > 0) return "in_progress";
  return "not_started";
}

function getMemberCompletionStatusLabel(status) {
  const labels = {
    complete: "Complete",
    in_progress: "In Progress",
    not_started: "Not Started"
  };

  return labels[status] || "Not Started";
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

function buildCoachWorkoutReviewRows(assignments, members, groupMemberships, logs, facilityId, groups = []) {
  const assignmentRows = assignments.map(assignment => {
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
    const activeMembers = memberRows.filter(row =>
      row.summary.completedSets > 0 && !row.summary.isComplete
    ).length;
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
      latestLog,
      targetLabel: formatAssignmentTarget(assignment)
    };
  });

  const groupedRows = new Map();

  assignmentRows.forEach(row => {
    const key = `${row.workout?.id || row.assignment.workout_id}:${row.assignment.assigned_date}`;
    const grouped = groupedRows.get(key) || {
      ...row,
      assignments: [],
      assignedMembers: [],
      targetLabels: new Set()
    };

    grouped.assignments.push(row.assignment);
    grouped.targetLabels.add(row.targetLabel);

    row.assignedMembers.forEach(member => {
      const existingMember = grouped.assignedMembers.find(item =>
        item.memberProfileId === member.memberProfileId
      );

      if (!existingMember) {
        grouped.assignedMembers.push({ ...member, logs: [...member.logs] });
        return;
      }

      const logsById = new Map(
        [...existingMember.logs, ...member.logs].map(log => [log.id, log])
      );
      existingMember.logs = Array.from(logsById.values());
      existingMember.summary = window.RipCityWorkoutData.summarizeSetLogs(
        existingMember.logs,
        grouped.workout
      );
    });

    groupedRows.set(key, grouped);
  });

  return Array.from(groupedRows.values()).map((row, index) => {
    const targetLabels = Array.from(row.targetLabels);
    const includesFacilityAssignment = row.assignments.some(assignment =>
      assignment.target_type === "facility" && assignment.target_facility_id === facilityId
    );
    const assignedGroupIds = new Set(
      row.assignments
        .filter(assignment => assignment.target_type === "group" && assignment.target_group_id)
        .map(assignment => assignment.target_group_id)
    );

    if (includesFacilityAssignment) {
      groups.forEach(group => assignedGroupIds.add(group.id));
    }

    const groupSummaries = groups
      .filter(group => assignedGroupIds.has(group.id))
      .map(group => {
        const groupMemberIds = new Set(
          groupMemberships
            .filter(membership => membership.group_id === group.id)
            .map(membership => membership.member_profile_id)
        );
        const groupMembers = row.assignedMembers.filter(member =>
          groupMemberIds.has(member.memberProfileId)
        );
        const completed = groupMembers.filter(member =>
          getMemberCompletionStatus(member) === "complete"
        ).length;

        return {
          id: group.id,
          name: group.name,
          members: groupMembers,
          completed,
          completionPercent: groupMembers.length
            ? Math.round((completed / groupMembers.length) * 100)
            : 0
        };
      })
      .filter(group => group.members.length)
      .sort((a, b) =>
        b.completionPercent - a.completionPercent ||
        b.completed - a.completed ||
        a.name.localeCompare(b.name)
      );

    return {
      ...row,
      completedMembers: row.assignedMembers.filter(member => member.summary.isComplete).length,
      activeMembers: row.assignedMembers.filter(member =>
        member.summary.completedSets > 0 && !member.summary.isComplete
      ).length,
      latestLog: row.assignedMembers
        .map(member => member.summary.lastLoggedAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null,
      targetLabel: targetLabels.length === 1
        ? targetLabels[0]
        : `${row.assignments.length} assignment targets`,
      groupSummaries,
      originalIndex: index
    };
  });
}

function getWorkoutReviewSearch() {
  return document.getElementById("coach-review-workout-search")?.value.trim().toLowerCase() || "";
}

function getFilteredWorkoutReviewRows(rows, searchTerm) {
  if (!searchTerm) return rows;

  return rows.filter(row => {
    const searchableText = [
      row.workout?.title,
      row.workout?.focus,
      row.targetLabel,
      row.assignment?.assigned_date,
      window.RipCityWorkoutData.formatDateLabel(row.assignment?.assigned_date)
    ].filter(Boolean).join(" ").toLowerCase();

    return searchableText.includes(searchTerm);
  });
}

async function refreshCoachWorkoutReview() {
  const list = document.getElementById("coach-workout-review-list");
  if (!list || !coachAccess) return;

  showCoachWorkoutReviewMessage("Loading workout completion...");

  try {
    const facilityId = coachAccess.membership.facility_id;
    const members = await loadApprovedFacilityMembers(facilityId);
    const groups = await loadCoachReviewGroups(facilityId);
    const groupMemberships = await loadFacilityGroupMemberships(
      members.map(member => member.memberProfileId)
    );
    const assignments = await loadRecentWorkoutAssignmentsForCoach(facilityId);
    const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
      assignments.map(assignment => assignment.id)
    );

    coachReviewMembers = members;
    coachReviewGroups = groups;
    coachWorkoutReviewRows = buildCoachWorkoutReviewRows(
      assignments,
      members,
      groupMemberships,
      logs,
      facilityId,
      groups
    );

    if (!coachWorkoutReviewRows.some(row => row.originalIndex === selectedCoachReviewRowIndex)) {
      selectedCoachReviewRowIndex = coachWorkoutReviewRows[0]?.originalIndex ?? null;
    }
    renderCoachWorkoutPicker();
    renderCoachWorkoutReview();
    showCoachWorkoutReviewMessage("");
  } catch (error) {
    console.error(error);
    showCoachWorkoutReviewMessage(error.message || "Could not load workout completion.", true);
    list.innerHTML = `<div class="empty-state">Could not load workout completion.</div>`;
  }
}

function getSelectedCoachReviewRow() {
  return coachWorkoutReviewRows.find(row => row.originalIndex === selectedCoachReviewRowIndex) || null;
}

function renderCoachWorkoutPicker() {
  const picker = document.getElementById("coach-review-workout-picker");
  if (!picker) return;

  const matches = getFilteredWorkoutReviewRows(coachWorkoutReviewRows, getWorkoutReviewSearch());
  if (!matches.some(row => row.originalIndex === selectedCoachReviewRowIndex)) {
    selectedCoachReviewRowIndex = matches[0]?.originalIndex ?? null;
  }

  picker.disabled = !matches.length;
  picker.innerHTML = matches.length
    ? matches.map(row => `
        <option value="${row.originalIndex}">
          ${window.RipCityUI.text(row.workout?.title, "Untitled Workout")} — ${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(row.assignment.assigned_date))} — ${window.RipCityUI.text(row.targetLabel)}
        </option>
      `).join("")
    : `<option value="">No assigned workouts match</option>`;

  if (selectedCoachReviewRowIndex !== null) {
    picker.value = String(selectedCoachReviewRowIndex);
  }

  renderCoachReviewGroupFilter();
}

function renderCoachReviewGroupFilter() {
  const filter = document.getElementById("coach-review-group-filter");
  if (!filter) return;

  const selectedRow = getSelectedCoachReviewRow();
  const currentValue = filter.value;
  const groups = selectedRow?.groupSummaries || [];
  filter.disabled = !groups.length;
  filter.innerHTML = `
    <option value="all">All assigned members</option>
    ${groups.map(group => `<option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>`).join("")}
  `;
  filter.value = groups.some(group => group.id === currentValue) ? currentValue : "all";
}

function renderCoachWorkoutReview() {
  const list = document.getElementById("coach-workout-review-list");
  const row = getSelectedCoachReviewRow();

  if (!row) {
    list.innerHTML = `<div class="empty-state">No assigned workouts match your search.</div>`;
    return;
  }

  const groupId = document.getElementById("coach-review-group-filter")?.value || "all";
  const memberSearch = document.getElementById("coach-review-member-search")?.value.trim().toLowerCase() || "";
  const groupSummary = row.groupSummaries.find(group => group.id === groupId);
  const sourceMembers = groupSummary ? groupSummary.members : row.assignedMembers;
  const members = sourceMembers.filter(member =>
    !memberSearch || `${member.name || ""} ${member.sport || ""}`.toLowerCase().includes(memberSearch)
  );

  renderCoachWorkoutReviewList(list, [{ ...row, displayMembers: members }], "No members match your search.");

  bindCoachWorkoutDetailButtons();
}

function renderCoachWorkoutReviewList(list, rows, emptyText) {
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">${window.RipCityUI.text(emptyText)}</div>`;
    return;
  }

  list.innerHTML = rows.map(row => {
    const members = row.displayMembers || row.assignedMembers;
    const memberCount = members.length;
    const completedMembers = members
      .filter(member => getMemberCompletionStatus(member) === "complete")
      .length;
    const activeMembers = members
      .filter(member => getMemberCompletionStatus(member) === "in_progress")
      .length;
    const notStartedMembers = memberCount - completedMembers - activeMembers;
    const latestLog = members
      .map(member => member.summary.lastLoggedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;
    const completionPercent = memberCount
      ? Math.round((completedMembers / memberCount) * 100)
      : 0;

    return `
      <article class="coach-workout-review-card" data-selected-workout>
        <div class="coach-workout-review-header">
          <div>
            <p class="eyebrow">${row.workout?.focus || "Workout"}</p>
            <h4>${window.RipCityUI.text(row.workout?.title, "Untitled Workout")}</h4>
            <p>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateLabel(row.assignment.assigned_date))} · ${window.RipCityUI.text(row.targetLabel)}</p>
          </div>

          <div class="coach-workout-review-summary">
            <span><strong>${completedMembers}/${memberCount}</strong> Complete</span>
            <span><strong>${activeMembers}</strong> In Progress</span>
            <span><strong>${notStartedMembers}</strong> Not Started</span>
          </div>
        </div>

        <div class="progress-bar coach-workout-progress">
          <div style="width: ${window.RipCityUI.percent(completionPercent)}%"></div>
        </div>

        <p class="coach-workout-latest">Latest activity: ${window.RipCityUI.text(window.RipCityWorkoutData.formatDateTimeLabel(latestLog))}</p>

        ${renderCoachGroupComparison(row.groupSummaries)}

        <div class="coach-workout-member-groups">
          ${renderCoachWorkoutStatusGroup("complete", members, row.originalIndex)}
          ${renderCoachWorkoutStatusGroup("in_progress", members, row.originalIndex)}
          ${renderCoachWorkoutStatusGroup("not_started", members, row.originalIndex)}
        </div>
      </article>
    `;
  }).join("");
}

function renderCoachGroupComparison(groups) {
  if (!groups.length) return "";

  return `
    <section class="coach-workout-group-comparison">
      <div class="coach-workout-status-heading">
        <h5>Group Comparison</h5>
        <span>Completion %</span>
      </div>
      <div class="coach-workout-group-ranking">
        ${groups.map((group, index) => `
          <button type="button" data-review-group="${window.RipCityUI.attr(group.id)}">
            <strong><span>${index + 1}</span>${window.RipCityUI.text(group.name)}</strong>
            <span>${group.completed}/${group.members.length} complete</span>
            <b>${group.completionPercent}%</b>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCoachWorkoutStatusGroup(status, members, rowIndex) {
  const matchingMembers = members.filter(member => getMemberCompletionStatus(member) === status);
  const labels = {
    complete: "Completed",
    in_progress: "In Progress",
    not_started: "Not Started"
  };

  return `
    <details class="coach-workout-status-group is-${status.replace("_", "-")}" ${status === "complete" ? "" : "open"}>
      <summary class="coach-workout-status-heading">
        <h5>${labels[status]}</h5>
        <span>${matchingMembers.length}</span>
      </summary>
      ${matchingMembers.length
        ? `<div class="coach-workout-member-table">${matchingMembers.map(member => renderCoachWorkoutMemberRow(member, rowIndex)).join("")}</div>`
        : `<p class="coach-workout-status-empty">No members</p>`}
    </details>
  `;
}

function bindCoachWorkoutDetailButtons() {
  document.querySelectorAll("[data-review-row][data-member-id]").forEach(button => {
    button.addEventListener("click", () => {
      const rowIndex = Number(button.dataset.reviewRow);
      const memberProfileId = button.dataset.memberId;
      openCoachWorkoutDetail(rowIndex, memberProfileId);
    });
  });

  document.querySelectorAll("[data-review-group]").forEach(button => {
    button.addEventListener("click", () => {
      const filter = document.getElementById("coach-review-group-filter");
      if (!filter) return;
      filter.value = button.dataset.reviewGroup;
      renderCoachWorkoutReview();
    });
  });
}

function renderCoachWorkoutMemberRow(member, rowIndex) {
  const status = getMemberCompletionStatus(member);
  const statusClass = status === "complete"
    ? "is-complete"
    : status === "in_progress"
      ? "is-active"
      : "is-empty";

  return `
    <div class="coach-workout-member-row">
      <div class="coach-review-member-cell">
        ${window.RipCityUI.avatarMarkup(member.name, member.profilePictureUrl, "coach-review-avatar")}
        <div>
          <strong>${window.RipCityUI.text(member.name)}</strong>
          <span>${window.RipCityUI.text(member.memberType)} ${member.sport ? `· ${window.RipCityUI.text(member.sport)}` : ""}</span>
        </div>
      </div>

      <div class="coach-review-member-metrics">
        <span class="coach-review-status ${statusClass}">${window.RipCityUI.text(getMemberCompletionStatusLabel(status))}</span>
        <span><small>Sets</small><strong>${member.summary.completedSets}/${member.summary.totalSets}</strong></span>
        <span><small>Progress</small><strong>${member.summary.completionPercent}%</strong></span>
        <span class="coach-review-member-latest"><small>Latest</small><strong>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateTimeLabel(member.summary.lastLoggedAt))}</strong></span>
      </div>
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
  if (assignment.target_type === "facility") return "Entire facility";

  if (assignment.target_type === "group") {
    const group = coachReviewGroups.find(row => row.id === assignment.target_group_id);
    return group ? `${group.name} group` : "Group assignment";
  }

  if (assignment.target_type === "member") {
    const member = coachReviewMembers.find(row =>
      row.memberProfileId === assignment.target_member_profile_id
    );

    return member ? member.name : "Individual assignment";
  }

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
        <p>${window.RipCityUI.text(exercise.sets || 1)} x ${window.RipCityUI.text(exercise.reps || "complete")}${exercise.is_unilateral ? " each side" : ""} · ${window.RipCityUI.text(exercise.input_type)}</p>
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

async function loadHabitLogsForAttention(memberProfileIds, todayKey) {
  if (!memberProfileIds.length) return [];

  const startKey = window.RipCityAttentionRules.addDays(todayKey, -3);
  const { data, error } = await db
    .from("habit_logs")
    .select("member_profile_id, log_date, completed")
    .in("member_profile_id", memberProfileIds)
    .gte("log_date", startKey)
    .lte("log_date", todayKey);

  if (error) throw error;
  return data || [];
}

function buildCoachAttentionRows(members, habitLogs, todayKey) {
  return members.map(member => {
    if (member.memberType === "h2k") {
      const attention = window.RipCityAttentionRules.calculateHabitAttention({
        logs: habitLogs.filter(log => log.member_profile_id === member.memberProfileId),
        todayKey,
        trackingStartDate: member.trackingStartDate
      });

      return attention.needsAttention ? {
        ...member,
        reason: "No habit tracking for 3 consecutive days",
        detail: "H2K habit follow-up"
      } : null;
    }

    const activity = coachWorkoutReviewRows.flatMap(row => {
      return row.assignedMembers
        .filter(assignedMember => assignedMember.memberProfileId === member.memberProfileId)
        .map(assignedMember => ({
          assigned_date: row.assignment.assigned_date,
          hasExerciseData: assignedMember.logs.length > 0
        }));
    });
    const attention = window.RipCityAttentionRules.calculateWorkoutAttention({
      activity,
      todayKey
    });

    return attention.needsAttention ? {
      ...member,
      reason: "No exercise data for 2 consecutive assigned-workout days",
      detail: "Athlete workout follow-up"
    } : null;
  }).filter(Boolean).sort((a, b) => {
    return a.memberType.localeCompare(b.memberType) || a.name.localeCompare(b.name);
  });
}

function updateCoachAttentionStats(members, attentionRows) {
  const h2kCount = members.filter(member => member.memberType === "h2k").length;
  const athleteCount = members.filter(member => member.memberType === "athlete").length;

  document.getElementById("coach-total-members").textContent = members.length;
  document.getElementById("coach-total-h2k-members").textContent = h2kCount;
  document.getElementById("coach-total-athletes").textContent = athleteCount;
  document.getElementById("coach-needs-attention").textContent = attentionRows.length;
  document.getElementById("coach-attention-summary-count").textContent = attentionRows.length;
}

function renderCoachAttentionList() {
  const list = document.getElementById("coach-attention-list");
  if (!list) return;

  const search = document.getElementById("coach-attention-search")?.value.trim().toLowerCase() || "";
  const memberType = document.getElementById("coach-attention-type-filter")?.value || "all";
  const rows = coachAttentionRows.filter(row => {
    const matchesSearch = !search || row.name.toLowerCase().includes(search);
    const matchesType = memberType === "all" || row.memberType === memberType;
    return matchesSearch && matchesType;
  });
  const resultsCount = document.getElementById("coach-attention-results-count");

  if (resultsCount) {
    resultsCount.textContent = coachAttentionRows.length
      ? `${rows.length} of ${coachAttentionRows.length} follow-ups shown`
      : "No follow-ups right now";
  }

  if (!coachAttentionRows.length) {
    list.innerHTML = `
      <div class="empty-state coach-attention-clear">
        Nobody currently meets the coach-approved follow-up rules.
      </div>
    `;
    return;
  }

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty-state">
        No members match this search and program filter.
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(row => `
    <article class="coach-attention-card">
      <div class="coach-member-card-heading">
        ${window.RipCityUI.avatarMarkup(row.name, row.profilePictureUrl, "coach-member-avatar")}
        <div>
          <p class="eyebrow">${window.RipCityUI.text(row.detail)}</p>
          <h4>${window.RipCityUI.text(row.name)}</h4>
          <p>${window.RipCityUI.text(row.reason)}</p>
        </div>
      </div>
      <a class="outline-link small-inline-btn" href="coach-member-detail.html?membership=${window.RipCityUI.attr(row.facilityMemberId)}">
        View Member
      </a>
    </article>
  `).join("");
}

// Loads everything for the coach dashboard.
async function refreshCoachDashboard() {
  showCoachDashboardMessage("Loading coach dashboard...");

  try {
    const facilityId = coachAccess.membership.facility_id;
    const todayKey = getTodayString();
    const members = await loadApprovedFacilityMembers(facilityId);
    const h2kMemberIds = members
      .filter(member => member.memberType === "h2k")
      .map(member => member.memberProfileId);
    const habitLogs = await loadHabitLogsForAttention(h2kMemberIds, todayKey);

    await refreshCoachWorkoutReview();
    const attentionRows = buildCoachAttentionRows(members, habitLogs, todayKey);

    coachAttentionRows = attentionRows;
    updateCoachAttentionStats(members, attentionRows);
    renderCoachAttentionList();

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

  ["coach-attention-search", "coach-attention-type-filter"].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener("input", renderCoachAttentionList);
  });

  document
    .getElementById("coach-review-workout-search")
    ?.addEventListener("input", () => {
      renderCoachWorkoutPicker();
      renderCoachWorkoutReview();
    });

  document
    .getElementById("coach-review-workout-picker")
    ?.addEventListener("change", event => {
      selectedCoachReviewRowIndex = event.target.value === "" ? null : Number(event.target.value);
      document.getElementById("coach-review-member-search").value = "";
      renderCoachReviewGroupFilter();
      renderCoachWorkoutReview();
    });

  ["coach-review-group-filter", "coach-review-member-search"].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener("input", renderCoachWorkoutReview);
  });

  document
    .getElementById("coach-logout-btn")
    .addEventListener("click", logoutCoachDashboard);
});
