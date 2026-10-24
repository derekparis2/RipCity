(function () {
  let memberProfile = null;
  let memberType = "athlete";
  let ownGroups = [];

  function showMessage(message, isError = false) {
    const element = document.getElementById("member-leaderboard-message");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error-message", isError);
  }

  function metricDefinitions() {
    return window.RipCityMetrics.getHabitLeaderboardMetricDefinitions();
  }

  function selectedMetric() {
    const key = document.getElementById("member-leaderboard-metric")?.value;
    return metricDefinitions().find(metric => metric.key === key) || metricDefinitions()[0];
  }

  function getTodayKey() {
    return window.RipCityWorkoutData?.getTodayString?.() || new Date().toISOString().slice(0, 10);
  }

  function formatScore(row, metric = selectedMetric()) {
    const score = row.score === null || row.score === undefined ? null : Number(row.score);
    if (score === null) return { primary: "No score yet", secondary: "Start checking in to earn a rank" };

    if (metric.key === "fourWeekAverage") {
      return { primary: `${score} / ${Number(row.score_max)}`, secondary: "Previous 4 weeks" };
    }
    if (metric.key === "currentWeekScore") {
      const days = Number(row.detail_count || 0);
      return {
        primary: `${score} / ${Number(row.score_max)}`,
        secondary: `${days} qualified day${days === 1 ? "" : "s"}`
      };
    }
    return {
      primary: window.RipCityMetrics.formatDayCount(score),
      secondary: metric.key === "currentStreak" ? "Current streak" : "Longest streak"
    };
  }

  function renderAvatar(row) {
    if (row.profile_picture_url) {
      return `<span class="member-leaderboard-avatar"><img src="${window.RipCityUI.attr(row.profile_picture_url)}" alt=""></span>`;
    }
    return `<span class="member-leaderboard-avatar">${window.RipCityUI.text(window.RipCityUI.safeInitials(row.full_name || "Member"))}</span>`;
  }

  function renderRankRow(row) {
    const value = formatScore(row);
    return `
      <article class="member-leaderboard-row ${row.is_self ? "is-self" : ""} ${Number(row.rank) <= 3 ? "is-podium" : ""}">
        <strong class="member-leaderboard-rank">#${Number(row.rank)}</strong>
        ${renderAvatar(row)}
        <div class="member-leaderboard-person">
          <strong>${window.RipCityUI.text(row.full_name || "Member")}${row.is_self ? " (You)" : ""}</strong>
          <span>${window.RipCityUI.text(row.group_names || "No group")}</span>
        </div>
        <div class="member-leaderboard-score"><strong>${window.RipCityUI.text(value.primary)}</strong><span>${window.RipCityUI.text(value.secondary)}</span></div>
      </article>
    `;
  }

  function render(rows) {
    const list = document.getElementById("member-leaderboard-list");
    const ownPanel = document.getElementById("member-own-rank");
    const ownContent = document.getElementById("member-own-rank-content");
    if (!list || !ownPanel || !ownContent) return;

    const topFive = rows.filter(row => row.rank !== null && Number(row.rank) <= 5);
    const self = rows.find(row => row.is_self);

    list.innerHTML = topFive.length
      ? topFive.map(renderRankRow).join("")
      : '<div class="empty-state">No ranked scores yet. Complete habits to start this leaderboard.</div>';

    ownPanel.classList.toggle("hidden", !self);
    if (!self) return;

    const value = formatScore(self);
    ownContent.innerHTML = `
      <div class="member-own-rank-number">${self.rank === null ? "—" : `#${Number(self.rank)}`}</div>
      <div><strong>${window.RipCityUI.text(value.primary)}</strong><span>${window.RipCityUI.text(value.secondary)}</span></div>
      <span class="member-own-rank-note">${self.rank !== null && Number(self.rank) <= 5 ? "You’re in the Top 5" : "Keep checking in to move up"}</span>
    `;
  }

  async function loadGroups() {
    const { data, error } = await db
      .from("group_members")
      .select("group:groups(id, name, member_type)")
      .eq("member_profile_id", memberProfile.id);
    if (error) throw error;

    const byId = new Map();
    (data || []).forEach(row => {
      const group = window.RipCityWorkoutData.normalizeJoinedOne(row.group);
      if (group?.id && (group.member_type === memberType || group.member_type === "both")) {
        byId.set(group.id, group);
      }
    });
    ownGroups = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function populateControls() {
    const metric = document.getElementById("member-leaderboard-metric");
    const scope = document.getElementById("member-leaderboard-scope");
    if (metric) {
      metric.innerHTML = metricDefinitions().map(item => `<option value="${window.RipCityUI.attr(item.key)}">${window.RipCityUI.text(item.label)}</option>`).join("");
    }
    if (scope) {
      const programLabel = memberType === "h2k" ? "H2K" : "Athletes";
      scope.innerHTML = `
        <option value="">All ${programLabel}</option>
        ${ownGroups.map(group => `<option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>`).join("")}
      `;
    }
  }

  function updateContext() {
    const label = memberType === "h2k" ? "H2K" : "Athlete";
    const scope = document.getElementById("member-leaderboard-scope");
    const scopeLabel = scope?.selectedOptions?.[0]?.textContent || `All ${label}s`;
    const metric = selectedMetric();
    document.getElementById("member-leaderboard-program-eyebrow").textContent = `${label.toUpperCase()} LEADERBOARD`;
    document.getElementById("member-leaderboard-title").textContent = `${scopeLabel} Top 5`;
    document.getElementById("member-leaderboard-explanation").textContent = `Ranked by ${metric.label}. A streak day requires at least four completed habits.`;
  }

  async function loadLeaderboard() {
    if (!memberProfile) return;
    showMessage("Loading leaderboard...");
    updateContext();

    const metricKey = document.getElementById("member-leaderboard-metric")?.value || "fourWeekAverage";
    const groupId = document.getElementById("member-leaderboard-scope")?.value || null;
    const { data, error } = await db.rpc("get_member_habit_leaderboard", {
      metric_key: metricKey,
      scope_group_id: groupId,
      as_of_date: getTodayKey()
    });
    if (error) throw error;
    render(data || []);
    showMessage("");
  }

  async function initialize({ profile }) {
    memberProfile = profile;
    memberType = profile?.member_type === "h2k" ? "h2k" : "athlete";
    await loadGroups();
    populateControls();
    await loadLeaderboard();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("member-leaderboard-metric")?.addEventListener("change", () => loadLeaderboard().catch(error => showMessage(error.message || "Could not load leaderboard.", true)));
    document.getElementById("member-leaderboard-scope")?.addEventListener("change", () => loadLeaderboard().catch(error => showMessage(error.message || "Could not load leaderboard.", true)));
    document.getElementById("member-leaderboard-refresh")?.addEventListener("click", () => loadLeaderboard().catch(error => showMessage(error.message || "Could not load leaderboard.", true)));
  });

  window.RipCityMemberLeaderboards = { initialize, load: loadLeaderboard };
})();
