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
let h2kHabits = [];
let todayLogs = [];

// Gets today's date in YYYY-MM-DD format.
// This is the format we store in Supabase date fields.
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// Gets the Monday of the current week.
// This lets us calculate the 42-point weekly score.
function getStartOfWeekString() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// Gets the Sunday of the current week.
function getEndOfWeekString() {
  const start = new Date(getStartOfWeekString());
  start.setDate(start.getDate() + 6);
  return start.toISOString().split("T")[0];
}

// Shows messages on the H2K page.
function showH2KMessage(message, isError = false) {
  const element = document.getElementById("h2k-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

// Gets the logged-in user and confirms they are approved.
async function getApprovedUserAccess() {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();

  if (sessionError) {
    console.error(sessionError);
    window.location.href = "login.html";
    return null;
  }

  const session = sessionData.session;

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  // Pull the user's profile and facility membership.
  // The !facility_members_profile_id_fkey part tells Supabase which relationship to use.
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      facility_members:facility_members!facility_members_profile_id_fkey (
        id,
        role,
        status,
        facility_id
      )
    `)
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    console.error(profileError);
    window.location.href = "login.html";
    return null;
  }

  const membership = profile.facility_members?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  return {
    session,
    profile,
    membership
  };
}

// Gets the member profile connected to the approved user.
// This tells us whether they are athlete or h2k.
async function getMemberProfile(facilityMemberId) {
  const { data, error } = await db
    .from("member_profiles")
    .select("*")
    .eq("facility_member_id", facilityMemberId)
    .single();

  if (error) throw error;
  return data;
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
  todayLogs = await loadTodayLogs(currentMemberProfile.id);
  renderHabitCards();
  await updateScores();
}

// Main startup function for the H2K page.
async function initH2KDashboard() {
  showH2KMessage("Loading H2K dashboard...");

  try {
    currentAccess = await getApprovedUserAccess();
    if (!currentAccess) return;

    currentMemberProfile = await getMemberProfile(currentAccess.membership.id);

    // If an athlete tries to access the H2K dashboard, send them back to the main app.
    if (currentMemberProfile.member_type !== "h2k") {
      window.location.href = "index.html";
      return;
    }

    h2kHabits = await loadHabits(currentAccess.membership.facility_id);

    await refreshH2KDashboard();
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

  document.getElementById("refresh-habits-btn").addEventListener("click", refreshH2KDashboard);
  document.getElementById("h2k-logout-btn").addEventListener("click", logoutH2K);
});