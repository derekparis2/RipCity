// =====================================================
// COACH LEADERBOARDS
// =====================================================
// Facility-scoped H2K habit consistency and athlete workout attendance.

let leaderboardAccess = null;
let leaderboardMembers = [];
let leaderboardGroups = [];
let leaderboardGroupMemberships = [];
let h2kLeaderboardRows = [];
let athleteLeaderboardRows = [];
let activeLeaderboardType = "h2k";

const LEADERBOARD_ASSIGNMENT_SELECT = `
  id,
  assigned_date,
  target_type,
  target_facility_id,
  target_group_id,
  target_member_profile_id,
  workout:workouts (
    id,
    facility_id,
    workout_blocks (
      id,
      block_order,
      workout_exercises (
        id,
        sets,
        exercise_order
      )
    )
  )
`;

function showLeaderboardMessage(message, isError = false) {
  const element = document.getElementById("leaderboard-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function loadLeaderboardMembers(facilityId) {
  const { data, error } = await db
    .from("facility_members")
    .select(`
      id,
      role,
      profile:profiles!facility_members_profile_id_fkey (
        full_name,
        email,
        profile_picture_url
      ),
      member_profile:member_profiles (
        id,
        member_type
      )
    `)
    .eq("facility_id", facilityId)
    .eq("status", "approved")
    .in("role", ["athlete", "h2k_member"]);

  if (error) throw error;

  return (data || []).map(row => {
    const memberProfile = window.RipCityWorkoutData.normalizeJoinedOne(row.member_profile);
    return {
      memberProfileId: memberProfile?.id,
      memberType: memberProfile?.member_type || (row.role === "h2k_member" ? "h2k" : "athlete"),
      name: row.profile?.full_name || "Unnamed Member",
      email: row.profile?.email || "",
      profilePictureUrl: row.profile?.profile_picture_url || ""
    };
  }).filter(member => member.memberProfileId);
}

async function loadLeaderboardGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("id, name, member_type")
    .eq("facility_id", facilityId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadGroupMemberships(memberProfileIds) {
  if (!memberProfileIds.length) return [];
  const { data, error } = await db
    .from("group_members")
    .select("group_id, member_profile_id")
    .in("member_profile_id", memberProfileIds);

  if (error) throw error;
  return data || [];
}

async function loadHabitLeaderboardData(facilityId, memberProfileIds) {
  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] = await Promise.all([
    db.from("habits").select("id").eq("facility_id", facilityId).eq("active", true),
    memberProfileIds.length
      ? db.from("habit_logs").select("member_profile_id, habit_id, log_date, completed, points_earned").in("member_profile_id", memberProfileIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (habitsError) throw habitsError;
  if (logsError) throw logsError;
  return { habitCount: (habits || []).length || 6, logs: logs || [] };
}

async function loadAthleteLeaderboardData(facilityId) {
  const todayKey = window.RipCityWorkoutData.getTodayString();
  const { data: assignments, error } = await db
    .from("workout_assignments")
    .select(LEADERBOARD_ASSIGNMENT_SELECT)
    .lte("assigned_date", todayKey)
    .order("assigned_date", { ascending: false });

  if (error) throw error;

  const facilityAssignments = (assignments || []).filter(row => row.workout?.facility_id === facilityId);
  const logs = await window.RipCityWorkoutData.loadSetLogsForAssignments(
    facilityAssignments.map(row => row.id)
  );

  return { assignments: facilityAssignments, logs };
}

function getMemberGroupIds(memberProfileId) {
  return leaderboardGroupMemberships
    .filter(row => row.member_profile_id === memberProfileId)
    .map(row => row.group_id);
}

function getMemberGroupNames(memberProfileId) {
  const ids = new Set(getMemberGroupIds(memberProfileId));
  const names = leaderboardGroups.filter(group => ids.has(group.id)).map(group => group.name);
  return names.length ? names.join(", ") : "No group";
}

function isAssignmentForMember(assignment, member, facilityId) {
  if (assignment.target_type === "facility") {
    return assignment.target_facility_id === facilityId;
  }
  if (assignment.target_type === "member") {
    return assignment.target_member_profile_id === member.memberProfileId;
  }
  if (assignment.target_type === "group") {
    return getMemberGroupIds(member.memberProfileId).includes(assignment.target_group_id);
  }
  return false;
}

function buildH2KRows(habitData, todayKey) {
  return leaderboardMembers
    .filter(member => member.memberType === "h2k")
    .map(member => ({
      ...member,
      groupIds: getMemberGroupIds(member.memberProfileId),
      groupNames: getMemberGroupNames(member.memberProfileId),
      metrics: window.RipCityMetrics.calculateH2KMetrics({
        logs: habitData.logs.filter(log => log.member_profile_id === member.memberProfileId),
        habitCount: habitData.habitCount,
        todayKey
      })
    }));
}

function buildAthleteRows(athleteData, facilityId, todayKey) {
  return leaderboardMembers
    .filter(member => member.memberType === "athlete")
    .map(member => {
      const visibleAssignments = window.RipCityWorkoutData.dedupeAssignmentsByWorkoutDate(
        athleteData.assignments.filter(assignment => isAssignmentForMember(assignment, member, facilityId))
      );
      const metricAssignments = visibleAssignments.map(assignment => {
        const logs = athleteData.logs.filter(log => {
          return log.workout_assignment_id === assignment.id &&
            log.member_profile_id === member.memberProfileId;
        });
        const summary = window.RipCityWorkoutData.summarizeSetLogs(logs, assignment.workout);
        return {
          id: assignment.id,
          assigned_date: assignment.assigned_date,
          isComplete: summary.isComplete
        };
      });

      return {
        ...member,
        groupIds: getMemberGroupIds(member.memberProfileId),
        groupNames: getMemberGroupNames(member.memberProfileId),
        metrics: window.RipCityMetrics.calculateAthleteMetrics({
          assignments: metricAssignments,
          todayKey
        })
      };
    });
}

function populateGroupFilter() {
  const select = document.getElementById("leaderboard-group-filter");
  if (!select) return;
  const currentValue = select.value;
  const relevantGroups = leaderboardGroups.filter(group => {
    if (!group.member_type) return true;
    return activeLeaderboardType === "h2k"
      ? group.member_type === "h2k"
      : group.member_type === "athlete";
  });

  select.innerHTML = `
    <option value="all">All groups</option>
    ${relevantGroups.map(group => `
      <option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>
    `).join("")}
  `;
  select.value = relevantGroups.some(group => group.id === currentValue) ? currentValue : "all";
}

function getRankedFilteredRows() {
  const groupId = document.getElementById("leaderboard-group-filter")?.value || "all";
  const search = document.getElementById("leaderboard-member-search")?.value.trim().toLowerCase() || "";
  let rows = activeLeaderboardType === "h2k" ? h2kLeaderboardRows : athleteLeaderboardRows;

  if (groupId !== "all") {
    rows = rows.filter(row => row.groupIds.includes(groupId));
  }

  const ranked = window.RipCityMetrics.assignCompetitionRanks(rows, row => {
    if (activeLeaderboardType === "h2k") {
      return row.metrics.hasScore ? row.metrics.fourWeekAverage : null;
    }
    return row.metrics.fourWeek.percent;
  });

  return ranked.filter(row => {
    return !search || `${row.name} ${row.email}`.toLowerCase().includes(search);
  });
}

function renderAvatar(row) {
  if (row.profilePictureUrl) {
    return `<span class="leaderboard-avatar"><img src="${window.RipCityUI.attr(row.profilePictureUrl)}" alt=""></span>`;
  }
  return `<span class="leaderboard-avatar">${window.RipCityUI.text(window.RipCityUI.safeInitials(row.name))}</span>`;
}

function renderMetric(primary, secondary = "") {
  return `
    <div class="leaderboard-metric">
      <strong>${window.RipCityUI.text(primary)}</strong>
      ${secondary ? `<small>${window.RipCityUI.text(secondary)}</small>` : ""}
    </div>
  `;
}

function renderH2KRow(row) {
  const average = row.metrics.fourWeekAverage === null ? "No score" : `${row.metrics.fourWeekAverage} / ${row.metrics.fourWeekMax}`;
  return `
    <article class="leaderboard-row ${row.rank && row.rank <= 3 ? "is-top-three" : ""}">
      <div class="leaderboard-rank">${row.rank ? `#${row.rank}` : "—"}</div>
      <div class="leaderboard-member">
        ${renderAvatar(row)}
        <div class="leaderboard-member-copy">
          <strong>${window.RipCityUI.text(row.name)}</strong>
          <span>${window.RipCityUI.text(row.groupNames)}</span>
        </div>
      </div>
      ${renderMetric(average, "Previous 4 weeks")}
      ${renderMetric(`${row.metrics.currentWeekScore} / ${row.metrics.currentWeekMax}`, `${row.metrics.currentWeekQualifiedDays} qualified days`)}
      ${renderMetric(`${row.metrics.currentStreak} days`, "Current streak")}
      ${renderMetric(`${row.metrics.longestStreak} days`, "Longest streak")}
    </article>
  `;
}

function renderAthleteRow(row) {
  const fourWeek = row.metrics.fourWeek.percent === null
    ? "No workouts"
    : `${row.metrics.fourWeek.percent}%`;
  const currentWeek = row.metrics.currentWeek.percent === null
    ? "No workouts"
    : `${row.metrics.currentWeek.percent}%`;
  return `
    <article class="leaderboard-row ${row.rank && row.rank <= 3 ? "is-top-three" : ""}">
      <div class="leaderboard-rank">${row.rank ? `#${row.rank}` : "—"}</div>
      <div class="leaderboard-member">
        ${renderAvatar(row)}
        <div class="leaderboard-member-copy">
          <strong>${window.RipCityUI.text(row.name)}</strong>
          <span>${window.RipCityUI.text(row.groupNames)}</span>
        </div>
      </div>
      ${renderMetric(fourWeek, row.metrics.fourWeek.assigned ? `${row.metrics.fourWeek.completed}/${row.metrics.fourWeek.assigned} completed` : "Previous 4 weeks")}
      ${renderMetric(currentWeek, row.metrics.currentWeek.assigned ? `${row.metrics.currentWeek.completed}/${row.metrics.currentWeek.assigned} completed` : "This week")}
      ${renderMetric(`${row.metrics.currentStreak} workout days`, "Current streak")}
      ${renderMetric(`${row.metrics.longestStreak} workout days`, "Longest streak")}
    </article>
  `;
}

function renderLeaderboards() {
  const list = document.getElementById("leaderboard-list");
  const context = document.getElementById("leaderboard-context");
  if (!list) return;
  const rows = getRankedFilteredRows();
  const isH2K = activeLeaderboardType === "h2k";

  if (context) {
    context.textContent = isH2K
      ? "Ranked by average weekly habit points across the previous four completed weeks. A streak day requires at least four completed habits."
      : "Ranked by completed assigned workouts across the previous four completed weeks. Only workouts assigned to each athlete count.";
  }

  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">No matching ${isH2K ? "H2K members" : "athletes"} yet.</div>`;
    return;
  }

  list.innerHTML = `
    <div class="leaderboard-scroll">
      <div class="leaderboard-column-labels">
        <span>Rank</span>
        <span>Member</span>
        <span>4-week result</span>
        <span>Current week</span>
        <span>Current streak</span>
        <span>Best streak</span>
      </div>
      ${rows.map(row => isH2K ? renderH2KRow(row) : renderAthleteRow(row)).join("")}
    </div>
  `;
}

function selectLeaderboardTab(type) {
  activeLeaderboardType = type;
  document.querySelectorAll("[data-leaderboard-tab]").forEach(button => {
    const active = button.dataset.leaderboardTab === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  populateGroupFilter();
  renderLeaderboards();
}

async function refreshLeaderboards() {
  showLeaderboardMessage("Loading facility leaderboards...");

  try {
    const facilityId = leaderboardAccess.membership.facility_id;
    const todayKey = window.RipCityWorkoutData.getTodayString();
    leaderboardMembers = await loadLeaderboardMembers(facilityId);
    leaderboardGroups = await loadLeaderboardGroups(facilityId);
    leaderboardGroupMemberships = await loadGroupMemberships(
      leaderboardMembers.map(member => member.memberProfileId)
    );

    const h2kMembers = leaderboardMembers.filter(member => member.memberType === "h2k");
    const [habitData, athleteData] = await Promise.all([
      loadHabitLeaderboardData(facilityId, h2kMembers.map(member => member.memberProfileId)),
      loadAthleteLeaderboardData(facilityId)
    ]);

    h2kLeaderboardRows = buildH2KRows(habitData, todayKey);
    athleteLeaderboardRows = buildAthleteRows(athleteData, facilityId, todayKey);
    populateGroupFilter();
    renderLeaderboards();
    showLeaderboardMessage("");
  } catch (error) {
    console.error(error);
    showLeaderboardMessage(error.message || "Could not load leaderboards.", true);
    document.getElementById("leaderboard-list").innerHTML = `<div class="empty-state">Could not load leaderboards.</div>`;
  }
}

async function initCoachLeaderboards() {
  try {
    leaderboardAccess = await window.RipCityAccess.requireCoachAccess({
      onDeniedMessage: showLeaderboardMessage
    });
    if (!leaderboardAccess) return;
    await refreshLeaderboards();
  } catch (error) {
    console.error(error);
    showLeaderboardMessage(error.message || "Could not open leaderboards.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-leaderboard-tab]").forEach(button => {
    button.addEventListener("click", () => selectLeaderboardTab(button.dataset.leaderboardTab));
  });
  document.getElementById("leaderboard-group-filter")?.addEventListener("change", renderLeaderboards);
  document.getElementById("leaderboard-member-search")?.addEventListener("input", renderLeaderboards);
  document.getElementById("refresh-leaderboards-btn")?.addEventListener("click", refreshLeaderboards);
  document.getElementById("leaderboard-logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "login.html";
  });
  initCoachLeaderboards();
});
