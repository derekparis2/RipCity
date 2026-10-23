// =====================================================
// COACH LEADERBOARDS
// =====================================================
// Facility-scoped habit consistency for H2K members and athletes.

let leaderboardAccess = null;
let leaderboardMembers = [];
let leaderboardGroups = [];
let leaderboardGroupMemberships = [];
let h2kLeaderboardRows = [];
let athleteLeaderboardRows = [];
let activeLeaderboardType = "h2k";
const selectedLeaderboardMetric = {
  h2k: "fourWeekAverage",
  athlete: "fourWeekAverage"
};

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

function formatDayCount(value, label = "day") {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

// This registry is the extension point for future lift, testing, and sport
// leaderboards. A future metric supplies one score function and one display
// function without changing the ranking or filtering system.
function getLeaderboardMetricDefinitions() {
  return [
      {
        key: "fourWeekAverage",
        label: "4-Week Average",
        score: row => row.metrics.hasScore ? row.metrics.fourWeekAverage : null,
        display: row => ({
          primary: row.metrics.fourWeekAverage === null
            ? "No score"
            : `${row.metrics.fourWeekAverage} / ${row.metrics.fourWeekMax}`,
          secondary: "Previous 4 weeks"
        })
      },
      {
        key: "currentWeekScore",
        label: "Current Week",
        score: row => row.metrics.currentWeekScore,
        display: row => ({
          primary: `${row.metrics.currentWeekScore} / ${row.metrics.currentWeekMax}`,
          secondary: `${row.metrics.currentWeekQualifiedDays} qualified days`
        })
      },
      {
        key: "currentStreak",
        label: "Current Streak",
        score: row => row.metrics.currentStreak,
        display: row => ({
          primary: formatDayCount(row.metrics.currentStreak),
          secondary: "Current streak"
        })
      },
      {
        key: "longestStreak",
        label: "Longest Streak",
        score: row => row.metrics.longestStreak,
        display: row => ({
          primary: formatDayCount(row.metrics.longestStreak),
          secondary: "Longest streak"
        })
      }
  ];
}

function getSelectedMetricDefinition() {
  const selectedKey = selectedLeaderboardMetric[activeLeaderboardType];
  return getLeaderboardMetricDefinitions().find(metric => metric.key === selectedKey) ||
    getLeaderboardMetricDefinitions()[0];
}

function getOrderedMetricDefinitions() {
  const selected = getSelectedMetricDefinition();
  return [
    selected,
    ...getLeaderboardMetricDefinitions().filter(metric => metric.key !== selected.key)
  ];
}

function buildHabitRows(memberType, habitData, todayKey) {
  return leaderboardMembers
    .filter(member => member.memberType === memberType)
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

function populateMetricFilter() {
  const select = document.getElementById("leaderboard-metric-filter");
  if (!select) return;

  select.innerHTML = getLeaderboardMetricDefinitions().map(metric => {
    return `<option value="${window.RipCityUI.attr(metric.key)}">${window.RipCityUI.text(metric.label)}</option>`;
  }).join("");
  select.value = selectedLeaderboardMetric[activeLeaderboardType];
}

function getRankedFilteredRows() {
  const groupId = document.getElementById("leaderboard-group-filter")?.value || "all";
  const search = document.getElementById("leaderboard-member-search")?.value.trim().toLowerCase() || "";
  let rows = activeLeaderboardType === "h2k" ? h2kLeaderboardRows : athleteLeaderboardRows;

  if (groupId !== "all") {
    rows = rows.filter(row => row.groupIds.includes(groupId));
  }

  const selectedMetric = getSelectedMetricDefinition();
  const ranked = window.RipCityMetrics.assignCompetitionRanks(rows, selectedMetric.score);

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

function renderLeaderboardRow(row) {
  const metrics = getOrderedMetricDefinitions();
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
      ${metrics.map(metric => {
        const display = metric.display(row);
        return renderMetric(display.primary, display.secondary);
      }).join("")}
    </article>
  `;
}

function renderLeaderboards() {
  const list = document.getElementById("leaderboard-list");
  const context = document.getElementById("leaderboard-context");
  if (!list) return;
  const rows = getRankedFilteredRows();
  const isH2K = activeLeaderboardType === "h2k";
  const orderedMetrics = getOrderedMetricDefinitions();
  const selectedMetric = orderedMetrics[0];

  if (context) {
    context.textContent = `Ranked by ${selectedMetric.label}. A streak day requires at least four completed habits.`;
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
        ${orderedMetrics.map((metric, index) => `
          <button
            class="leaderboard-sort-button ${index === 0 ? "active" : ""}"
            type="button"
            data-leaderboard-metric="${window.RipCityUI.attr(metric.key)}"
            aria-pressed="${index === 0 ? "true" : "false"}"
          >${window.RipCityUI.text(index === 0 ? `Rank: ${metric.label}` : metric.label)}</button>
        `).join("")}
      </div>
      ${rows.map(renderLeaderboardRow).join("")}
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
  populateMetricFilter();
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

    const habitData = await loadHabitLeaderboardData(
      facilityId,
      leaderboardMembers.map(member => member.memberProfileId)
    );

    h2kLeaderboardRows = buildHabitRows("h2k", habitData, todayKey);
    athleteLeaderboardRows = buildHabitRows("athlete", habitData, todayKey);
    populateGroupFilter();
    populateMetricFilter();
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
  document.getElementById("leaderboard-metric-filter")?.addEventListener("change", event => {
    selectedLeaderboardMetric[activeLeaderboardType] = event.target.value;
    renderLeaderboards();
  });
  document.getElementById("leaderboard-member-search")?.addEventListener("input", renderLeaderboards);
  document.getElementById("leaderboard-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-leaderboard-metric]");
    if (!button) return;
    selectedLeaderboardMetric[activeLeaderboardType] = button.dataset.leaderboardMetric;
    populateMetricFilter();
    renderLeaderboards();
  });
  document.getElementById("refresh-leaderboards-btn")?.addEventListener("click", refreshLeaderboards);
  document.getElementById("leaderboard-logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "login.html";
  });
  initCoachLeaderboards();
});
