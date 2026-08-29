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
let coachReviewFilterOptions = {
  targets: new Map()
};

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

function showCoachSignupLinkMessage(message, isError = false) {
  const element = document.getElementById("coach-signup-link-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function buildCoachSignupLink(type) {
  const signupUrl = new URL("signup.html", window.location.href);

  if (type === "athlete" || type === "h2k") {
    signupUrl.searchParams.set("type", type);
  }

  return signupUrl.href;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand("copy");
  input.remove();

  if (!copied) {
    throw new Error("Copy failed. Select and copy the link manually.");
  }
}

async function copyCoachSignupLink(type) {
  const link = buildCoachSignupLink(type);

  try {
    await copyTextToClipboard(link);
    const labels = {
      athlete: "Athlete signup link copied.",
      h2k: "H2K signup link copied.",
      general: "General signup link copied."
    };

    showCoachSignupLinkMessage(labels[type] || "Signup link copied.");
  } catch (error) {
    console.error(error);
    showCoachSignupLinkMessage(link, true);
  }
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
    .lte("assigned_date", getTodayString())
    .order("assigned_date", { ascending: false })
    .limit(60);

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

function buildCoachWorkoutReviewRows(assignments, members, groupMemberships, logs, facilityId) {
  return assignments.map((assignment, index) => {
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
      targetKey: getAssignmentFilterKey(assignment),
      originalIndex: index,
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
      latestLog,
      targetKey: getAssignmentFilterKey(assignment),
      originalIndex: index
    };
  });
}

function getAssignmentFilterKey(assignment) {
  if (assignment.target_type === "group") return `group:${assignment.target_group_id || ""}`;
  if (assignment.target_type === "member") return `member:${assignment.target_member_profile_id || ""}`;
  if (assignment.target_type === "facility") return `facility:${assignment.target_facility_id || ""}`;
  return "assignment:unknown";
}

function buildCoachReviewFilterOptions(rows) {
  const targets = new Map();

  rows.forEach(row => {
    targets.set(row.targetKey, formatAssignmentTarget(row.assignment));
  });

  coachReviewFilterOptions = { targets };
  renderCoachReviewFilters();
}

function renderCoachReviewFilters() {
  const dateFilter = document.getElementById("coach-review-date-filter");
  const targetFilter = document.getElementById("coach-review-target-filter");
  if (!dateFilter || !targetFilter) return;

  const selectedTarget = targetFilter.value;

  if (!dateFilter.value) {
    dateFilter.value = getTodayString();
  }

  targetFilter.innerHTML = `
    <option value="all">All assignments</option>
    ${Array.from(coachReviewFilterOptions.targets.entries()).map(([key, label]) => `
      <option value="${window.RipCityUI.attr(key)}">${window.RipCityUI.text(label)}</option>
    `).join("")}
  `;

  if (coachReviewFilterOptions.targets.has(selectedTarget)) {
    targetFilter.value = selectedTarget;
  }
}

function getCoachReviewFilters() {
  return {
    memberType: document.getElementById("coach-review-member-type-filter")?.value || "all",
    selectedDate: document.getElementById("coach-review-date-filter")?.value || getTodayString(),
    targetKey: document.getElementById("coach-review-target-filter")?.value || "all",
    status: document.getElementById("coach-review-status-filter")?.value || "all"
  };
}

function getFilteredMembersForReviewRow(row, filters) {
  return row.assignedMembers.filter(member => {
    const status = getMemberCompletionStatus(member);

    if (filters.memberType !== "all" && member.memberType !== filters.memberType) return false;
    if (filters.status !== "all" && status !== filters.status) return false;

    return true;
  });
}

function getFilteredWorkoutReviewRows(rows, filters) {
  return rows
    .filter(row => {
      if (filters.targetKey !== "all" && row.targetKey !== filters.targetKey) return false;
      return getFilteredMembersForReviewRow(row, filters).length > 0;
    })
    .map(row => ({
      ...row,
      filteredMembers: getFilteredMembersForReviewRow(row, filters)
    }));
}

function getReviewSectionCounts(rows) {
  const assignmentCount = rows.length;
  const memberCount = rows.reduce((total, row) => total + row.filteredMembers.length, 0);

  return `${assignmentCount} ${assignmentCount === 1 ? "assignment" : "assignments"} · ${memberCount} ${memberCount === 1 ? "member" : "members"}`;
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
      facilityId
    );

    buildCoachReviewFilterOptions(coachWorkoutReviewRows);
    renderCoachWorkoutReview(coachWorkoutReviewRows);
    showCoachWorkoutReviewMessage("");
  } catch (error) {
    console.error(error);
    showCoachWorkoutReviewMessage(error.message || "Could not load workout completion.", true);
    list.innerHTML = `<div class="empty-state">Could not load workout completion.</div>`;
    const previousList = document.getElementById("coach-workout-previous-list");
    if (previousList) {
      previousList.innerHTML = `<div class="empty-state">Could not load previous workout completion.</div>`;
    }
  }
}

function renderCoachWorkoutReview(rows) {
  const list = document.getElementById("coach-workout-review-list");
  const previousList = document.getElementById("coach-workout-previous-list");
  const todayCount = document.getElementById("coach-review-today-count");
  const previousCount = document.getElementById("coach-review-previous-count");
  const selectedDateHeading = document.getElementById("coach-review-selected-date-heading");
  const filters = getCoachReviewFilters();
  const today = getTodayString();

  const filteredRows = getFilteredWorkoutReviewRows(rows, filters);
  const selectedDateRows = filteredRows.filter(row =>
    row.assignment.assigned_date === filters.selectedDate
  );
  const previousRows = filteredRows.filter(row =>
    row.assignment.assigned_date < today &&
    row.assignment.assigned_date !== filters.selectedDate
  );

  if (selectedDateHeading) {
    selectedDateHeading.textContent = filters.selectedDate === today
      ? "Today's Workout Completion"
      : `${window.RipCityWorkoutData.formatDateLabel(filters.selectedDate)} Completion`;
  }

  if (todayCount) todayCount.textContent = getReviewSectionCounts(selectedDateRows);
  if (previousCount) previousCount.textContent = previousRows.length ? getReviewSectionCounts(previousRows) : "No previous matches";

  renderCoachWorkoutReviewList(
    list,
    selectedDateRows,
    "No workouts assigned for this date match these filters."
  );

  renderCoachWorkoutReviewList(
    previousList,
    previousRows,
    "No previous workouts match these filters."
  );

  bindCoachWorkoutDetailButtons();
}

function renderCoachWorkoutReviewList(list, rows, emptyText) {
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">${window.RipCityUI.text(emptyText)}</div>`;
    return;
  }

  list.innerHTML = rows.map(row => {
    const members = row.filteredMembers || row.assignedMembers;
    const memberCount = members.length;
    const completedMembers = members
      .filter(member => getMemberCompletionStatus(member) === "complete")
      .length;
    const activeMembers = members
      .filter(member => getMemberCompletionStatus(member) === "in_progress")
      .length;
    const latestLog = members
      .map(member => member.summary.lastLoggedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;
    const completionPercent = memberCount
      ? Math.round((completedMembers / memberCount) * 100)
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
            <span><strong>${completedMembers}/${memberCount}</strong> Complete</span>
            <span><strong>${activeMembers}</strong> In Progress</span>
            <span><strong>${window.RipCityUI.text(window.RipCityWorkoutData.formatDateTimeLabel(latestLog))}</strong> Latest</span>
          </div>
        </div>

        <div class="progress-bar coach-workout-progress">
          <div style="width: ${window.RipCityUI.percent(completionPercent)}%"></div>
        </div>

        <div class="coach-workout-member-table">
          ${members.map(member => renderCoachWorkoutMemberRow(member, row.originalIndex)).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function bindCoachWorkoutDetailButtons() {
  document.querySelectorAll("[data-review-row][data-member-id]").forEach(button => {
    button.addEventListener("click", () => {
      const rowIndex = Number(button.dataset.reviewRow);
      const memberProfileId = button.dataset.memberId;
      openCoachWorkoutDetail(rowIndex, memberProfileId);
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

      <span class="coach-review-status ${statusClass}">${window.RipCityUI.text(getMemberCompletionStatusLabel(status))}</span>
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

    const historyMembers = await loadApprovedFacilityMembers(coachAccess.membership.facility_id);
    coachHistoryMembers = buildCoachWeeklyMemberOptionsFromApproved(historyMembers);
    if (
      selectedCoachWeeklyMemberId &&
      !coachHistoryMembers.some(member => member.memberProfileId === selectedCoachWeeklyMemberId)
    ) {
      selectedCoachWeeklyMemberId = null;
    }

    updateCoachStats(rows);
    renderCoachMemberList(rows);
    renderCoachWeeklyMemberResults();
    await refreshCoachWeeklyHistory();
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

  document.querySelectorAll("[data-copy-signup-link]").forEach(button => {
    button.addEventListener("click", () => copyCoachSignupLink(button.dataset.copySignupLink));
  });

  document
    .getElementById("refresh-coach-dashboard-btn")
    .addEventListener("click", refreshCoachDashboard);

  document
    .getElementById("refresh-workout-review-btn")
    ?.addEventListener("click", refreshCoachWorkoutReview);

  document
    .getElementById("refresh-coach-weekly-history-btn")
    ?.addEventListener("click", refreshCoachWeeklyHistory);

  document
    .getElementById("coach-weekly-prev-week")
    ?.addEventListener("click", () => changeCoachWeeklyHistoryWeek("previous"));

  document
    .getElementById("coach-weekly-next-week")
    ?.addEventListener("click", () => changeCoachWeeklyHistoryWeek("next"));

  document
    .getElementById("coach-weekly-member-search")
    ?.addEventListener("input", renderCoachWeeklyMemberResults);

  document
    .getElementById("coach-weekly-member-type-filter")
    ?.addEventListener("input", async () => {
      const selectedType = document.getElementById("coach-weekly-member-type-filter")?.value || "all";
      const selectedMember = coachHistoryMembers.find(member =>
        member.memberProfileId === selectedCoachWeeklyMemberId
      );

      if (selectedType !== "all" && selectedMember?.memberType !== selectedType) {
        selectedCoachWeeklyMemberId = null;
      }

      renderCoachWeeklyMemberResults();
      await refreshCoachWeeklyHistory();
    });

  [
    "coach-review-member-type-filter",
    "coach-review-date-filter",
    "coach-review-target-filter",
    "coach-review-status-filter"
  ].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener("input", () => renderCoachWorkoutReview(coachWorkoutReviewRows));
  });

  document
    .getElementById("coach-logout-btn")
    .addEventListener("click", logoutCoachDashboard);
});
