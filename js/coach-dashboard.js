// =====================================================
// COACH DASHBOARD
// =====================================================
// This page gives coaches/admins a quick view of H2K
// habit tracking across approved members.

let coachAccess = null;
let coachHabits = [];

// Gets today's date in YYYY-MM-DD format.
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// Gets Monday of current week.
function getStartOfWeekString() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// Gets Sunday of current week.
function getEndOfWeekString() {
  const start = new Date(getStartOfWeekString());
  start.setDate(start.getDate() + 6);
  return start.toISOString().split("T")[0];
}

function showCoachDashboardMessage(message, isError = false) {
  const element = document.getElementById("coach-dashboard-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

// Gets the current logged-in user.
async function getCurrentSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  return data.session;
}

// Gets the current user's profile and facility membership.
async function getCurrentUserProfile(userId) {
  const { data, error } = await db
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
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

// Protects this page so only approved coaches/admins can view it.
async function requireCoachOrAdminForDashboard() {
  const session = await getCurrentSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const profile = await getCurrentUserProfile(session.user.id);
  const membership =
    profile.facility_members?.[0] ||
    profile["facility_members!facility_members_profile_id_fkey"]?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  if (membership.role !== "coach" && membership.role !== "admin") {
    showCoachDashboardMessage("You do not have permission to view this page.", true);
    return null;
  }

  return {
    session,
    profile,
    membership
  };
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
          <h4>${row.name}</h4>
          <p>${row.email}</p>
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
            <strong>${statusText}</strong>
          </div>
        </div>

        <div class="progress-bar coach-progress-bar">
          <div style="width: ${weeklyPercent}%"></div>
        </div>
      </article>
    `;
  }).join("");
}

// Loads everything for the coach dashboard.
async function refreshCoachDashboard() {
  showCoachDashboardMessage("Loading coach dashboard...");

  try {
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
    .getElementById("coach-logout-btn")
    .addEventListener("click", logoutCoachDashboard);
});