// =====================================================
// MEMBER TESTING DAY SCHEDULE
// =====================================================
// Members can see only Testing Days to which they were snapshotted as a
// participant and only their own official results. Result entry stays staff-only.

let memberTestingParticipations = [];
const expandedMemberTestingDayIds = new Set();

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

function renderMemberTestingDays(participations = memberTestingParticipations) {
  const list = document.getElementById("member-testing-list");
  const count = document.getElementById("member-testing-count");
  if (!list) return;

  const search = document.getElementById("member-testing-search")?.value.trim().toLowerCase() || "";
  const allDays = participations
    .map(participation => ({ participation, day: Array.isArray(participation.testing_day) ? participation.testing_day[0] : participation.testing_day }))
    .filter(item => item.day)
    .sort((a, b) => b.day.testing_date.localeCompare(a.day.testing_date));
  const days = allDays.filter(({ day }) => {
    const tests = (day.testing_day_tests || []).map(test => test.name).join(" ");
    return !search || `${day.name} ${day.description || ""} ${day.testing_date} ${formatMemberTestingDate(day.testing_date)} ${tests}`.toLowerCase().includes(search);
  });

  if (count) count.textContent = `${allDays.length} assigned`;

  if (!allDays.length) {
    list.innerHTML = `<div class="empty-state">No Testing Days are assigned to you yet.</div>`;
    return;
  }
  if (!days.length) {
    list.innerHTML = `<div class="empty-state">No Testing Days match that search.</div>`;
    return;
  }

  list.innerHTML = days.map(({ participation, day }) => {
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
      </article>
    `;
  }).join("");
}

async function initializeMemberTestingDays() {
  const panel = document.getElementById("member-testing-panel");
  if (!panel) return;

  try {
    const access = await window.RipCityAccess.requireApprovedAccess();
    if (!access || !["athlete", "h2k_member"].includes(access.membership.role)) return;
    const memberProfile = await window.RipCityAccess.getMemberProfileForMembership(access.membership.id);

    const { data, error } = await db.from("testing_day_participants")
      .select(`
        id,
        participation_status,
        testing_day:testing_days(
          id,name,description,testing_date,status,
          testing_day_tests(
            id,name,unit,input_type,test_order,
            testing_results(id,testing_day_participant_id,result_status,numeric_value,text_value,notes)
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
    if (orderedDays[0]) expandedMemberTestingDayIds.add(orderedDays[0].id);
    window.RipCityTestingDateKeys = new Set(orderedDays
      .filter(day => ["scheduled", "completed"].includes(day.status))
      .map(day => day.testing_date));
    window.dispatchEvent(new CustomEvent("ripcity:testing-days-loaded"));
    renderMemberTestingDays();
  } catch (error) {
    console.error(error);
    const migrationMissing = error.code === "42P01" || /testing_day/i.test(error.message || "");
    if (migrationMissing) {
      panel.classList.add("hidden");
      return;
    }
    showMemberTestingMessage(error.message || "Could not load Testing Days.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("member-testing-search")?.addEventListener("input", () => renderMemberTestingDays());
  document.getElementById("member-testing-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-member-testing-toggle]");
    if (!button) return;
    const dayId = button.dataset.memberTestingToggle;
    if (expandedMemberTestingDayIds.has(dayId)) expandedMemberTestingDayIds.delete(dayId);
    else expandedMemberTestingDayIds.add(dayId);
    renderMemberTestingDays();
  });
  initializeMemberTestingDays();
});
