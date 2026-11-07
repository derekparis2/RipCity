// =====================================================
// MEMBER TESTING DAY SCHEDULE
// =====================================================
// Members can see only Testing Days to which they were snapshotted as a
// participant and only their own official results. Result entry stays staff-only.

let memberTestingParticipations = [];
const expandedMemberTestingDayIds = new Set();
let activeMemberTrainingView = "schedule";
const memberTestingComparisonPageSize = 6;
let memberTestingComparisonLimit = memberTestingComparisonPageSize;

const memberTrainingViewCopy = {
  schedule: {
    pageTitle: "Training Calendar",
    eyebrow: "YOUR SCHEDULE",
    title: "Every assigned workout, organized by day.",
    description: "Select a date to open, preview, or review a workout."
  },
  performance: {
    pageTitle: "Performance",
    eyebrow: "YOUR PROGRESS",
    title: "See what is improving over time.",
    description: "Compare official Testing Day results, baselines, and personal records."
  }
};

function setMemberTrainingView(view) {
  const nextView = memberTrainingViewCopy[view] ? view : "schedule";
  activeMemberTrainingView = nextView;
  document.querySelectorAll("[data-training-view-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.trainingViewPanel !== nextView);
  });
  document.querySelectorAll("[data-training-view]").forEach(button => {
    const selected = button.dataset.trainingView === nextView;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  const copy = memberTrainingViewCopy[nextView];
  const pageTitle = document.getElementById("member-training-page-title");
  const eyebrow = document.getElementById("member-training-hero-eyebrow");
  const title = document.getElementById("member-training-hero-title");
  const description = document.getElementById("member-training-hero-description");
  if (pageTitle) pageTitle.textContent = copy.pageTitle;
  if (eyebrow) eyebrow.textContent = copy.eyebrow;
  if (title) title.textContent = copy.title;
  if (description) description.textContent = copy.description;
}

function showMemberTestingMessage(message, isError = false) {
  const element = document.getElementById("member-testing-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function formatMemberTestingDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMemberTestingResult(test, result) {
  if (!result) return "Pending";
  if (result.result_status === "not_tested") return "Not tested";
  const value = test.input_type === "text" ? result.text_value : result.numeric_value;
  return `${value ?? "Pending"}${value != null && test.unit ? ` ${test.unit}` : ""}`;
}

function getTestingComparisonTone(value) {
  if (!Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "improved" : "declined";
}

function renderTestingComparisonCard(comparison) {
  const metrics = window.RipCityTestingComparisons;
  const latestTone = getTestingComparisonTone(comparison.improvementFromPrevious);
  const baselineTone = getTestingComparisonTone(comparison.improvementFromBaseline);
  const latestDate = formatMemberTestingDate(comparison.latest.date);
  const previousDate = comparison.previous ? formatMemberTestingDate(comparison.previous.date) : "Needs another result";

  return `
    <details class="testing-comparison-card">
      <summary>
        <div><span class="eyebrow">${window.RipCityUI.text(comparison.resultCount === 1 ? "BASELINE RECORDED" : `${comparison.resultCount} OFFICIAL RESULTS`)}</span><h5>${window.RipCityUI.text(comparison.testName)}</h5><p>${window.RipCityUI.text(latestDate)}</p></div>
        <div class="testing-comparison-latest"><span>Latest</span><strong>${window.RipCityUI.text(metrics.formatValue(comparison.latest.value, comparison.unit))}</strong>${comparison.resultCount > 1 ? `<small class="comparison-${latestTone}">${window.RipCityUI.text(metrics.formatImprovement(comparison.improvementFromPrevious, comparison.unit))} vs prior</small>` : ""}</div>
        <span class="testing-comparison-toggle" aria-hidden="true"></span>
      </summary>
      <div class="testing-comparison-details">
        ${comparison.resultCount === 1 ? `<p class="testing-comparison-hint">Complete this test on another finalized Testing Day to unlock improvement comparisons.</p>` : ""}
        <div class="testing-comparison-stats">
          <div><span>Baseline</span><strong>${window.RipCityUI.text(metrics.formatValue(comparison.baseline.value, comparison.unit))}</strong><small>${window.RipCityUI.text(formatMemberTestingDate(comparison.baseline.date))}</small></div>
          <div><span>Previous</span><strong>${window.RipCityUI.text(comparison.previous ? metrics.formatValue(comparison.previous.value, comparison.unit) : "—")}</strong><small>${window.RipCityUI.text(previousDate)}</small></div>
          <div><span>Personal record</span><strong>${window.RipCityUI.text(metrics.formatValue(comparison.best.value, comparison.unit))}</strong><small>${comparison.isPersonalRecord && comparison.resultCount > 1 ? "Latest result is a PR" : window.RipCityUI.text(formatMemberTestingDate(comparison.best.date))}</small></div>
        </div>
        ${comparison.resultCount > 1 ? `<div class="testing-comparison-improvements"><div class="comparison-${latestTone}"><span>Since previous</span><strong>${window.RipCityUI.text(metrics.formatImprovement(comparison.improvementFromPrevious, comparison.unit))}</strong><small>${window.RipCityUI.text(metrics.formatPercent(comparison.percentFromPrevious))}</small></div><div class="comparison-${baselineTone}"><span>Since baseline</span><strong>${window.RipCityUI.text(metrics.formatImprovement(comparison.improvementFromBaseline, comparison.unit))}</strong><small>${window.RipCityUI.text(metrics.formatPercent(comparison.percentFromBaseline))}</small></div></div>` : ""}
      </div>
    </details>`;
}

function renderMemberTestingComparisons() {
  const list = document.getElementById("member-testing-comparison-list");
  const count = document.getElementById("member-testing-comparison-count");
  const moreButton = document.getElementById("member-testing-comparison-more");
  if (!list || !window.RipCityTestingComparisons) return;
  const comparisons = window.RipCityTestingComparisons.build(memberTestingParticipations);
  const query = document.getElementById("member-testing-comparison-search")?.value || "";
  const sort = document.getElementById("member-testing-comparison-sort")?.value || "recent";
  const filteredComparisons = window.RipCityTestingComparisons.filterAndSort(comparisons, query, sort);
  const visibleComparisons = filteredComparisons.slice(0, memberTestingComparisonLimit);
  if (count) {
    count.textContent = filteredComparisons.length === comparisons.length
      ? `${comparisons.length} tracked ${comparisons.length === 1 ? "test" : "tests"}`
      : `${filteredComparisons.length} of ${comparisons.length} tests`;
  }
  if (!comparisons.length) {
    list.innerHTML = `<div class="empty-state">Your completed ranked tests will show improvement comparisons here.</div>`;
    if (moreButton) moreButton.hidden = true;
    return;
  }
  if (!filteredComparisons.length) {
    list.innerHTML = `<div class="empty-state">No tracked tests match that search.</div>`;
    if (moreButton) moreButton.hidden = true;
    return;
  }
  list.innerHTML = visibleComparisons.map(renderTestingComparisonCard).join("");
  window.RipCityTestingComparisons.enforceSingleOpen(list);
  if (moreButton) {
    const remaining = filteredComparisons.length - visibleComparisons.length;
    moreButton.hidden = filteredComparisons.length <= memberTestingComparisonPageSize;
    moreButton.textContent = remaining > 0
      ? `Show ${Math.min(memberTestingComparisonPageSize, remaining)} more tests`
      : "Show fewer tests";
    moreButton.dataset.allVisible = String(remaining === 0);
  }
}

function initializeMemberTestingComparisonControls() {
  const search = document.getElementById("member-testing-comparison-search");
  const sort = document.getElementById("member-testing-comparison-sort");
  const moreButton = document.getElementById("member-testing-comparison-more");
  const resetAndRender = () => {
    memberTestingComparisonLimit = memberTestingComparisonPageSize;
    renderMemberTestingComparisons();
  };
  search?.addEventListener("input", resetAndRender);
  sort?.addEventListener("change", resetAndRender);
  moreButton?.addEventListener("click", () => {
    memberTestingComparisonLimit = moreButton.dataset.allVisible === "true"
      ? memberTestingComparisonPageSize
      : memberTestingComparisonLimit + memberTestingComparisonPageSize;
    renderMemberTestingComparisons();
  });
}

function getMemberTestingDays(participations = memberTestingParticipations) {
  return participations
    .map(participation => ({ participation, day: Array.isArray(participation.testing_day) ? participation.testing_day[0] : participation.testing_day }))
    .filter(item => item.day);
}

function renderMemberTestingDayCard({ participation, day }) {
  const tests = [...(day.testing_day_tests || [])].sort((a, b) => a.test_order - b.test_order);
  const absent = participation.participation_status === "did_not_participate";
  const expanded = expandedMemberTestingDayIds.has(day.id);
  return `
    <article class="member-testing-card ${expanded ? "" : "is-collapsed"}" data-member-testing-day="${window.RipCityUI.attr(day.id)}">
      <div class="member-testing-card-header">
        <div><p class="eyebrow">${window.RipCityUI.text(day.status === "completed" ? "FINAL RESULTS" : "UPCOMING TESTING DAY")}</p><h4>${window.RipCityUI.text(day.name)}</h4></div>
        <div class="member-testing-card-actions"><span class="member-testing-date">${window.RipCityUI.text(formatMemberTestingDate(day.testing_date))}</span><button class="outline-btn small-inline-btn" type="button" data-member-testing-toggle="${window.RipCityUI.attr(day.id)}" aria-expanded="${expanded}">${expanded ? "Hide −" : "View +"}</button></div>
      </div>
      <div class="member-testing-card-details ${expanded ? "" : "hidden"}">
        ${day.description ? `<p class="member-testing-description">${window.RipCityUI.text(day.description)}</p>` : ""}
        <div class="member-testing-tests">
        ${tests.map((test, index) => `
          ${(() => {
            const result = (test.testing_results || []).find(item => item.testing_day_participant_id === participation.id);
            const state = absent ? "absent" : !result ? "pending" : result.result_status === "not_tested" ? "not-tested" : "recorded";
            return `<div class="member-testing-test result-${state}">
            <span>${index + 1}. ${window.RipCityUI.text(test.name)}</span>
            <span>${window.RipCityUI.text(absent ? "Did not participate" : formatMemberTestingResult(test, result))}</span>
          </div>`;
          })()}
        `).join("")}
        </div>
        ${absent ? `<p class="member-testing-footnote">Your coach marked you as not participating in this Testing Day.</p>` : ""}
      </div>
    </article>`;
}

function renderMemberTestingDays(participations = memberTestingParticipations) {
  const upcomingList = document.getElementById("member-testing-upcoming-list");
  const upcomingCount = document.getElementById("member-testing-upcoming-count");
  const historyList = document.getElementById("member-testing-list");
  const historyCount = document.getElementById("member-testing-count");
  if (!upcomingList || !historyList) return;

  const allDays = getMemberTestingDays(participations);
  const upcomingDays = allDays
    .filter(({ day }) => day.status === "scheduled")
    .sort((a, b) => a.day.testing_date.localeCompare(b.day.testing_date));
  const completedDays = allDays
    .filter(({ day }) => day.status === "completed")
    .sort((a, b) => b.day.testing_date.localeCompare(a.day.testing_date));
  const search = document.getElementById("member-testing-search")?.value.trim().toLowerCase() || "";
  const filteredCompletedDays = completedDays.filter(({ day }) => {
    const tests = (day.testing_day_tests || []).map(test => test.name).join(" ");
    return !search || `${day.name} ${day.description || ""} ${day.testing_date} ${formatMemberTestingDate(day.testing_date)} ${tests}`.toLowerCase().includes(search);
  });

  if (upcomingCount) upcomingCount.textContent = `${upcomingDays.length} upcoming`;
  if (historyCount) historyCount.textContent = `${completedDays.length} completed`;
  upcomingList.innerHTML = upcomingDays.length
    ? upcomingDays.map(renderMemberTestingDayCard).join("")
    : `<div class="empty-state">No upcoming Testing Days are scheduled.</div>`;

  if (!completedDays.length) {
    historyList.innerHTML = `<div class="empty-state">Completed Testing Days and official results will appear here.</div>`;
    return;
  }
  if (!filteredCompletedDays.length) {
    historyList.innerHTML = `<div class="empty-state">No completed Testing Days match that search.</div>`;
    return;
  }
  historyList.innerHTML = filteredCompletedDays.map(renderMemberTestingDayCard).join("");
}

async function initializeMemberTestingDays() {
  const panel = document.getElementById("member-testing-panel");
  const schedulePanel = document.getElementById("member-testing-schedule-panel");
  if (!panel || !schedulePanel) return;

  try {
    const access = await window.RipCityAccess.requireMemberAccess();
    if (!access || !["athlete", "h2k_member"].includes(access.membership.role)) return;
    const memberProfile = await window.RipCityAccess.getMemberProfileForMembership(access.membership.id);

    const { data, error } = await db.from("testing_day_participants")
      .select(`
        id,
        participation_status,
        testing_day:testing_days(
          id,name,description,testing_date,status,
          testing_day_tests(
            id,name,unit,input_type,ranking_direction,test_order,
            testing_results(id,testing_day_participant_id,result_status,numeric_value,text_value,notes,recorded_at)
          )
        )
      `)
      .eq("member_profile_id", memberProfile.id);

    if (error) throw error;
    memberTestingParticipations = data || [];
    const orderedDays = memberTestingParticipations
      .map(item => Array.isArray(item.testing_day) ? item.testing_day[0] : item.testing_day)
      .filter(Boolean)
      .sort((a, b) => b.testing_date.localeCompare(a.testing_date));
    window.RipCityTestingDateKeys = new Set(orderedDays
      .filter(day => ["scheduled", "completed"].includes(day.status))
      .map(day => day.testing_date));
    window.dispatchEvent(new CustomEvent("ripcity:testing-days-loaded"));
    renderMemberTestingComparisons();
    renderMemberTestingDays();
  } catch (error) {
    console.error(error);
    const migrationMissing = error.code === "42P01" || /testing_day/i.test(error.message || "");
    if (migrationMissing) {
      panel.classList.add("hidden");
      schedulePanel.classList.add("hidden");
      return;
    }
    showMemberTestingMessage(error.message || "Could not load Testing Days.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeMemberTestingComparisonControls();
  document.querySelectorAll("[data-training-view]").forEach(button => {
    button.addEventListener("click", () => setMemberTrainingView(button.dataset.trainingView));
  });
  setMemberTrainingView(activeMemberTrainingView);
  document.getElementById("member-testing-search")?.addEventListener("input", () => renderMemberTestingDays());
  ["member-testing-list", "member-testing-upcoming-list"].forEach(listId => {
    document.getElementById(listId)?.addEventListener("click", event => {
      const button = event.target.closest("[data-member-testing-toggle]");
      if (!button) return;
      const dayId = button.dataset.memberTestingToggle;
      if (expandedMemberTestingDayIds.has(dayId)) expandedMemberTestingDayIds.delete(dayId);
      else expandedMemberTestingDayIds.add(dayId);
      renderMemberTestingDays();
    });
  });
  initializeMemberTestingDays();
});
