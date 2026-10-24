// =====================================================
// MEMBER TESTING DAY SCHEDULE
// =====================================================
// Members can see only Testing Days to which they were snapshotted as a
// participant. Official-result entry and result visibility remain disabled
// until Rip City chooses the approved workflow.

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

function renderMemberTestingDays(participations) {
  const list = document.getElementById("member-testing-list");
  const count = document.getElementById("member-testing-count");
  if (!list) return;

  const days = participations
    .map(row => Array.isArray(row.testing_day) ? row.testing_day[0] : row.testing_day)
    .filter(Boolean)
    .sort((a, b) => a.testing_date.localeCompare(b.testing_date));

  if (count) count.textContent = `${days.length} assigned`;

  if (!days.length) {
    list.innerHTML = `<div class="empty-state">No Testing Days are assigned to you yet.</div>`;
    return;
  }

  list.innerHTML = days.map(day => {
    const tests = [...(day.testing_day_tests || [])].sort((a, b) => a.test_order - b.test_order);
    return `
      <article class="member-testing-card">
        <div class="member-testing-card-header">
          <div><p class="eyebrow">${window.RipCityUI.text(day.status === "completed" ? "COMPLETED TESTING DAY" : "UPCOMING TESTING DAY")}</p><h4>${window.RipCityUI.text(day.name)}</h4></div>
          <span class="member-testing-date">${window.RipCityUI.text(formatMemberTestingDate(day.testing_date))}</span>
        </div>
        ${day.description ? `<p class="member-testing-description">${window.RipCityUI.text(day.description)}</p>` : ""}
        <div class="member-testing-tests">
          ${tests.map((test, index) => `
            <div class="member-testing-test">
              <span>${index + 1}. ${window.RipCityUI.text(test.name)}</span>
              <span>${window.RipCityUI.text(test.unit || (test.input_type === "time" ? "Time" : "Recorded result"))}</span>
            </div>
          `).join("")}
        </div>
        <p class="member-testing-footnote">Your coach will share official result details when they are available.</p>
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
        testing_day:testing_days(
          id,name,description,testing_date,status,
          testing_day_tests(id,name,unit,input_type,test_order)
        )
      `)
      .eq("member_profile_id", memberProfile.id);

    if (error) throw error;
    renderMemberTestingDays(data || []);
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

document.addEventListener("DOMContentLoaded", initializeMemberTestingDays);
