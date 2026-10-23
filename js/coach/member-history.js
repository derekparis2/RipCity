// =====================================================
// COACH MEMBER WEEKLY HISTORY
// =====================================================
// Member-specific habit history shown from coach-member-detail.

(function () {
  const HISTORY_WEEK_COUNT = 12;
  let historyAccess = null;
  let historyMember = null;
  let historyWeeks = [];
  let historyData = null;
  let selectedWeekIndex = 0;

  function formatLocalDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function buildWeeks() {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const currentMonday = addDays(today, mondayOffset);

    return Array.from({ length: HISTORY_WEEK_COUNT }, (_, index) => {
      const start = addDays(currentMonday, index * -7);
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

  function formatWeekLabel(week) {
    const options = { month: "short", day: "numeric" };
    return `${week.start.toLocaleDateString(undefined, options)} - ${week.end.toLocaleDateString(undefined, options)}`;
  }

  function getMemberProfile() {
    return window.RipCityWorkoutData.normalizeJoinedOne(historyMember.member_profile);
  }

  function showMessage(message, isError = false) {
    const element = document.getElementById("coach-member-history-message");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error-message", isError);
  }

  async function loadHabitHistory(memberProfile) {
    const [{ data: habits, error: habitError }, { data: logs, error: logError }] = await Promise.all([
      db.from("habits")
        .select("id")
        .eq("facility_id", historyMember.facility_id)
        .eq("active", true),
      db.from("habit_logs")
        .select("habit_id, log_date, completed, points_earned")
        .eq("member_profile_id", memberProfile.id)
        .gte("log_date", historyWeeks.at(-1).startKey)
        .lte("log_date", historyWeeks[0].endKey)
    ]);

    if (habitError) throw habitError;
    if (logError) throw logError;
    return { logs: logs || [], weeklyMax: (habits || []).length * 7 };
  }

  function buildHabitRow(week) {
    const weekLogs = historyData.logs.filter(log => {
      return log.log_date >= week.startKey && log.log_date <= week.endKey;
    });
    const score = weekLogs
      .filter(log => log.completed)
      .reduce((total, log) => total + Number(log.points_earned || 0), 0);
    const loggedDays = new Set(
      weekLogs.filter(log => log.completed).map(log => log.log_date)
    ).size;

    return {
      typeLabel: "Habit Score",
      score,
      maxScore: historyData.weeklyMax,
      detail: `${loggedDays}/7 days logged`,
      percent: historyData.weeklyMax ? Math.round((score / historyData.weeklyMax) * 100) : 0
    };
  }

  function render() {
    const list = document.getElementById("coach-member-history-list");
    const week = historyWeeks[selectedWeekIndex];
    if (!list || !week || !historyData) return;

    document.getElementById("coach-member-history-context").textContent = week.isCurrentWeek ? "CURRENT WEEK" : "WEEK";
    document.getElementById("coach-member-history-label").textContent = formatWeekLabel(week);
    document.getElementById("coach-member-history-prev").disabled = selectedWeekIndex >= historyWeeks.length - 1;
    document.getElementById("coach-member-history-next").disabled = selectedWeekIndex <= 0;

    const row = buildHabitRow(week);
    list.innerHTML = `
      <article class="weekly-score-card ${week.isCurrentWeek ? "is-current-week" : ""}">
        <div class="weekly-score-main">
          <div>
            <p class="eyebrow">${window.RipCityUI.text(row.typeLabel)}</p>
            <h4>${window.RipCityUI.text(formatWeekLabel(week))}</h4>
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

  async function refresh() {
    if (!historyMember) return;
    showMessage("Loading weekly history...");

    try {
      const memberProfile = getMemberProfile();
      historyWeeks = buildWeeks();
      historyData = await loadHabitHistory(memberProfile);
      document.getElementById("coach-member-history-description").textContent =
        "Review this member’s habit score for the last 12 weeks.";
      render();
      showMessage("");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Could not load weekly history.", true);
      document.getElementById("coach-member-history-list").innerHTML = `
        <div class="empty-state">Could not load weekly history.</div>
      `;
    }
  }

  function changeWeek(direction) {
    selectedWeekIndex += direction === "previous" ? 1 : -1;
    selectedWeekIndex = Math.max(0, Math.min(selectedWeekIndex, historyWeeks.length - 1));
    render();
  }

  async function init({ access, member }) {
    historyAccess = access;
    historyMember = member;
    selectedWeekIndex = 0;
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("refresh-member-history-btn")?.addEventListener("click", refresh);
    document.getElementById("coach-member-history-prev")?.addEventListener("click", () => changeWeek("previous"));
    document.getElementById("coach-member-history-next")?.addEventListener("click", () => changeWeek("next"));
  });

  window.RipCityCoachMemberHistory = { init };
})();
