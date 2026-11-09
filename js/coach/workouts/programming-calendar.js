// =====================================================
// COACH PROGRAMMING CALENDAR
// =====================================================
// Presents the existing workout assignments as a group or individual weekly
// calendar. Assignment rows remain the source of truth; no duplicate calendar
// records are created.

let programmingWeekStart = getProgrammingWeekStart(new Date());

function parseProgrammingDate(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
}

function formatProgrammingIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getProgrammingWeekStart(date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function addProgrammingDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getProgrammingWeekDates() {
  return Array.from({ length: 7 }, (_, index) => addProgrammingDays(programmingWeekStart, index));
}

function setProgrammingView(viewName) {
  document.querySelectorAll("[data-programming-view]").forEach(button => {
    const isActive = button.dataset.programmingView === viewName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-programming-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.programmingPanel !== viewName);
  });
}

function renderProgrammingScopeOptions() {
  const type = document.getElementById("programming-scope-type")?.value || "group";
  const select = document.getElementById("programming-scope-id");
  const label = document.getElementById("programming-scope-label");
  if (!select || !label) return;

  const previousValue = select.value;
  label.textContent = type === "group" ? "Group" : "Member";
  const options = type === "group"
    ? availableGroups.map(group => ({ id: group.id, label: group.name }))
    : availableMembers.map(member => ({
        id: member.memberProfileId,
        label: `${member.name} · ${getMemberGroupNames(member.memberProfileId).join(", ") || "No group"}`
      }));

  select.innerHTML = options.length
    ? options.map(option => `<option value="${window.RipCityUI.attr(option.id)}">${window.RipCityUI.text(option.label)}</option>`).join("")
    : `<option value="">No ${type === "group" ? "groups" : "members"} available</option>`;
  select.value = options.some(option => option.id === previousValue) ? previousValue : options[0]?.id || "";
  renderProgrammingCalendar();
}

function getProgrammingMemberGroupIds(memberProfileId) {
  return new Set(
    availableGroupMemberships
      .filter(row => row.member_profile_id === memberProfileId)
      .map(row => row.group_id)
  );
}

function getProgrammingAssignments() {
  const type = document.getElementById("programming-scope-type")?.value || "group";
  const scopeId = document.getElementById("programming-scope-id")?.value || "";
  if (!scopeId) return [];

  const memberGroupIds = type === "member" ? getProgrammingMemberGroupIds(scopeId) : new Set();
  const rows = [];

  recentWorkoutRows.forEach(workout => {
    (workout.workout_assignments || []).forEach(assignment => {
      let sourceLabel = "";
      if (assignment.target_type === "facility") {
        sourceLabel = "Facility-wide";
      } else if (type === "group" && assignment.target_type === "group" && assignment.target_group_id === scopeId) {
        sourceLabel = availableGroups.find(group => group.id === scopeId)?.name || "Group";
      } else if (type === "member" && assignment.target_type === "member" && assignment.target_member_profile_id === scopeId) {
        sourceLabel = "Direct assignment";
      } else if (type === "member" && assignment.target_type === "group" && memberGroupIds.has(assignment.target_group_id)) {
        sourceLabel = availableGroups.find(group => group.id === assignment.target_group_id)?.name || "Group assignment";
      } else {
        return;
      }

      rows.push({ workout, assignment, sourceLabel });
    });
  });

  const uniqueRows = new Map();
  rows.forEach(row => {
    const key = `${row.workout.id}:${row.assignment.assigned_date}`;
    if (!uniqueRows.has(key)) uniqueRows.set(key, row);
  });
  return [...uniqueRows.values()];
}

function renderProgrammingCalendar() {
  const grid = document.getElementById("programming-calendar-grid");
  const weekLabel = document.getElementById("programming-week-label");
  const description = document.getElementById("programming-calendar-description");
  const copyButton = document.getElementById("copy-programming-week");
  if (!grid || !weekLabel || !description || !copyButton) return;

  const type = document.getElementById("programming-scope-type")?.value || "group";
  const scopeSelect = document.getElementById("programming-scope-id");
  const scopeId = scopeSelect?.value || "";
  const scopeName = scopeSelect?.selectedOptions?.[0]?.textContent || "";
  const dates = getProgrammingWeekDates();
  const firstDate = dates[0];
  const lastDate = dates[6];
  weekLabel.textContent = `${firstDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  if (!scopeId) {
    description.textContent = `Choose a ${type} to view its schedule.`;
    copyButton.disabled = true;
    grid.innerHTML = `<div class="empty-state">No schedule is available yet.</div>`;
    return;
  }

  const assignments = getProgrammingAssignments();
  const weekDateKeys = new Set(dates.map(formatProgrammingIsoDate));
  const weekAssignments = assignments.filter(row => weekDateKeys.has(row.assignment.assigned_date));
  const copyableAssignments = weekAssignments.filter(row =>
    row.assignment.target_type === "group" && row.assignment.target_group_id === scopeId
  );
  description.textContent = `${scopeName} · ${weekAssignments.length} workout${weekAssignments.length === 1 ? "" : "s"} this week`;
  copyButton.disabled = type !== "group" || copyableAssignments.length === 0;

  grid.innerHTML = dates.map(date => {
    const dateKey = formatProgrammingIsoDate(date);
    const dayAssignments = weekAssignments.filter(row => row.assignment.assigned_date === dateKey);
    const isToday = dateKey === formatProgrammingIsoDate(new Date());
    return `
      <article class="programming-calendar-day ${isToday ? "is-today" : ""}">
        <header>
          <span>${window.RipCityUI.text(date.toLocaleDateString(undefined, { weekday: "short" }))}</span>
          <strong>${date.getDate()}</strong>
        </header>
        <div class="programming-calendar-day-workouts">
          ${dayAssignments.length ? dayAssignments.map(row => `
            <button class="programming-calendar-workout" type="button" data-calendar-workout="${window.RipCityUI.attr(row.workout.id)}">
              <strong>${window.RipCityUI.text(row.workout.title)}</strong>
              <span>${window.RipCityUI.text(row.workout.focus || "Workout")}</span>
              <small>${window.RipCityUI.text(row.sourceLabel)}</small>
            </button>
          `).join("") : `<span class="programming-calendar-empty-day">No workout</span>`}
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-calendar-workout]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.calendarWorkout);
      if (!workout) return;
      loadWorkoutIntoBuilder(workout);
    });
  });
}

function openProgrammingWeekCopy() {
  const form = document.getElementById("programming-copy-week-form");
  const date = document.getElementById("programming-copy-week-date");
  if (!form || !date) return;
  date.value = formatProgrammingIsoDate(addProgrammingDays(programmingWeekStart, 7));
  form.classList.remove("hidden");
  date.focus();
}

function closeProgrammingWeekCopy() {
  document.getElementById("programming-copy-week-form")?.classList.add("hidden");
}

async function copyProgrammingWeek() {
  const groupId = document.getElementById("programming-scope-id")?.value || "";
  const destinationDateValue = document.getElementById("programming-copy-week-date")?.value || "";
  const destinationDate = destinationDateValue ? getProgrammingWeekStart(parseProgrammingDate(destinationDateValue)) : null;
  if (!groupId || !destinationDate) return showWorkoutMessage("Choose a destination week.", true);

  const sourceDateValue = formatProgrammingIsoDate(programmingWeekStart);
  const destinationWeekValue = formatProgrammingIsoDate(destinationDate);
  const groupName = document.getElementById("programming-scope-id")?.selectedOptions?.[0]?.textContent || "this group";
  if (!window.confirm(`Copy ${groupName}'s workouts from ${formatDisplayDate(sourceDateValue)} to the week of ${formatDisplayDate(destinationWeekValue)}?`)) return;

  const button = document.getElementById("confirm-copy-programming-week");
  button.disabled = true;
  button.textContent = "Copying...";
  try {
    const { data, error } = await db.rpc("copy_group_programming_week", {
      check_group_id: groupId,
      check_source_week_start: sourceDateValue,
      check_destination_week_start: destinationWeekValue
    });
    if (error) throw error;
    closeProgrammingWeekCopy();
    await loadRecentWorkouts();
    programmingWeekStart = destinationDate;
    renderProgrammingCalendar();
    showWorkoutMessage(`${data} workout${Number(data) === 1 ? "" : "s"} copied to the new week.`);
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not copy the programming week.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Confirm Copy";
  }
}

function moveProgrammingWeek(offset) {
  programmingWeekStart = addProgrammingDays(programmingWeekStart, offset * 7);
  renderProgrammingCalendar();
}

function initProgrammingCalendar() {
  document.querySelectorAll("[data-programming-view]").forEach(button => {
    button.addEventListener("click", () => setProgrammingView(button.dataset.programmingView));
  });
  document.getElementById("programming-scope-type")?.addEventListener("change", renderProgrammingScopeOptions);
  document.getElementById("programming-scope-id")?.addEventListener("change", renderProgrammingCalendar);
  document.getElementById("programming-previous-week")?.addEventListener("click", () => moveProgrammingWeek(-1));
  document.getElementById("programming-next-week")?.addEventListener("click", () => moveProgrammingWeek(1));
  document.getElementById("programming-current-week")?.addEventListener("click", () => {
    programmingWeekStart = getProgrammingWeekStart(new Date());
    renderProgrammingCalendar();
  });
  document.getElementById("copy-programming-week")?.addEventListener("click", openProgrammingWeekCopy);
  document.getElementById("cancel-copy-programming-week")?.addEventListener("click", closeProgrammingWeekCopy);
  document.getElementById("confirm-copy-programming-week")?.addEventListener("click", copyProgrammingWeek);
}
