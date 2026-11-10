// =====================================================
// COACH PROGRAMMING CALENDAR
// =====================================================
// Presents normal workout assignments in one month view. Individual schedules
// combine direct, group, and facility assignments; only direct assignments are
// selectable for copying so inherited work is never duplicated accidentally.

let programmingMonth = getProgrammingMonthStart(new Date());
let selectedProgrammingAssignmentIds = new Set();
let programmingCopySourceStart = null;

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

function getProgrammingMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
}

function addProgrammingDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addProgrammingMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0);
}

function getProgrammingMonthDates() {
  const firstGridDate = getProgrammingWeekStart(programmingMonth);
  return Array.from({ length: 42 }, (_, index) => addProgrammingDays(firstGridDate, index));
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
  clearProgrammingSelection();
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
      let isDirect = false;
      if (assignment.target_type === "facility") {
        sourceLabel = "Facility-wide";
      } else if (type === "group" && assignment.target_type === "group" && assignment.target_group_id === scopeId) {
        sourceLabel = availableGroups.find(group => group.id === scopeId)?.name || "Group";
        isDirect = true;
      } else if (type === "member" && assignment.target_type === "member" && assignment.target_member_profile_id === scopeId) {
        sourceLabel = "Direct assignment";
        isDirect = true;
      } else if (type === "member" && assignment.target_type === "group" && memberGroupIds.has(assignment.target_group_id)) {
        sourceLabel = availableGroups.find(group => group.id === assignment.target_group_id)?.name || "Group assignment";
      } else {
        return;
      }

      rows.push({ workout, assignment, sourceLabel, isDirect });
    });
  });

  const uniqueRows = new Map();
  rows.forEach(row => {
    const key = `${row.workout.id}:${row.assignment.assigned_date}`;
    const existing = uniqueRows.get(key);
    if (!existing || (!existing.isDirect && row.isDirect)) uniqueRows.set(key, row);
  });
  return [...uniqueRows.values()];
}

function getVisibleMonthAssignments(assignments = getProgrammingAssignments()) {
  return assignments.filter(row => {
    const date = parseProgrammingDate(row.assignment.assigned_date);
    return date.getFullYear() === programmingMonth.getFullYear() && date.getMonth() === programmingMonth.getMonth();
  });
}

function getCopyableAssignments(assignments = getProgrammingAssignments()) {
  return assignments.filter(row => row.isDirect);
}

function updateProgrammingSelectionActions() {
  const selectedCount = selectedProgrammingAssignmentIds.size;
  const copySelected = document.getElementById("copy-programming-selected");
  const clear = document.getElementById("clear-programming-selection");
  if (copySelected) {
    copySelected.disabled = selectedCount === 0;
    copySelected.textContent = selectedCount ? `Copy Selected (${selectedCount})` : "Copy Selected";
  }
  if (clear) clear.disabled = selectedCount === 0;
}

function renderProgrammingCalendar() {
  const grid = document.getElementById("programming-calendar-grid");
  const monthLabel = document.getElementById("programming-month-label");
  const description = document.getElementById("programming-calendar-description");
  const copyMonth = document.getElementById("copy-programming-month");
  if (!grid || !monthLabel || !description || !copyMonth) return;

  const type = document.getElementById("programming-scope-type")?.value || "group";
  const scopeSelect = document.getElementById("programming-scope-id");
  const scopeId = scopeSelect?.value || "";
  const scopeName = scopeSelect?.selectedOptions?.[0]?.textContent || "";
  monthLabel.textContent = programmingMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  if (!scopeId) {
    description.textContent = `Choose a ${type} to view its schedule.`;
    copyMonth.disabled = true;
    grid.innerHTML = `<div class="empty-state">No schedule is available yet.</div>`;
    updateProgrammingSelectionActions();
    return;
  }

  const assignments = getProgrammingAssignments();
  const visibleAssignments = getVisibleMonthAssignments(assignments);
  const copyableMonthAssignments = visibleAssignments.filter(row => row.isDirect);
  const validAssignmentIds = new Set(getCopyableAssignments(assignments).map(row => row.assignment.id));
  selectedProgrammingAssignmentIds = new Set([...selectedProgrammingAssignmentIds].filter(id => validAssignmentIds.has(id)));
  description.textContent = `${scopeName} · ${visibleAssignments.length} workout${visibleAssignments.length === 1 ? "" : "s"} this month`;
  copyMonth.disabled = copyableMonthAssignments.length === 0;

  const dates = getProgrammingMonthDates();
  grid.innerHTML = dates.map((date, index) => {
    const dateKey = formatProgrammingIsoDate(date);
    const dayAssignments = assignments.filter(row => row.assignment.assigned_date === dateKey);
    const isToday = dateKey === formatProgrammingIsoDate(new Date());
    const isOutsideMonth = date.getMonth() !== programmingMonth.getMonth();
    const weekEnd = addProgrammingDays(date, 6);
    const weekCopyable = index % 7 === 0
      ? getCopyableAssignments(assignments).filter(row => row.assignment.assigned_date >= dateKey && row.assignment.assigned_date <= formatProgrammingIsoDate(weekEnd))
      : [];
    return `
      <article class="programming-calendar-day ${isToday ? "is-today" : ""} ${isOutsideMonth ? "is-outside-month" : ""}">
        <header>
          <strong>${date.getDate()}</strong>
          ${index % 7 === 0 && weekCopyable.length ? `<button type="button" data-copy-calendar-week="${dateKey}" title="Copy this week">Copy week</button>` : ""}
        </header>
        <div class="programming-calendar-day-workouts">
          ${dayAssignments.length ? dayAssignments.map(row => `
            <article class="programming-calendar-workout ${row.isDirect ? "is-direct" : "is-inherited"}">
              ${row.isDirect ? `
                <label class="programming-calendar-select" title="Select this workout to copy">
                  <input type="checkbox" data-calendar-assignment="${window.RipCityUI.attr(row.assignment.id)}" ${selectedProgrammingAssignmentIds.has(row.assignment.id) ? "checked" : ""} />
                  <span class="sr-only">Select ${window.RipCityUI.text(row.workout.title)}</span>
                </label>
              ` : ""}
              <button type="button" data-calendar-workout="${window.RipCityUI.attr(row.workout.id)}">
                <strong>${window.RipCityUI.text(row.workout.title)}</strong>
                <span>${window.RipCityUI.text(row.workout.focus || "Workout")}</span>
                <small>${window.RipCityUI.text(row.sourceLabel)}${row.isDirect ? "" : " · inherited"}</small>
              </button>
            </article>
          `).join("") : `<span class="programming-calendar-empty-day">No workout</span>`}
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-calendar-workout]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.calendarWorkout);
      openWorkoutInBuilder(workout);
    });
  });
  grid.querySelectorAll("[data-calendar-assignment]").forEach(input => {
    input.addEventListener("change", () => {
      if (input.checked) selectedProgrammingAssignmentIds.add(input.dataset.calendarAssignment);
      else selectedProgrammingAssignmentIds.delete(input.dataset.calendarAssignment);
      updateProgrammingSelectionActions();
    });
  });
  grid.querySelectorAll("[data-copy-calendar-week]").forEach(button => {
    button.addEventListener("click", () => prepareProgrammingWeekCopy(button.dataset.copyCalendarWeek));
  });
  updateProgrammingSelectionActions();
}

function selectProgrammingAssignments(rows) {
  selectedProgrammingAssignmentIds = new Set(rows.filter(row => row.isDirect).map(row => row.assignment.id));
  renderProgrammingCalendar();
}

function clearProgrammingSelection() {
  selectedProgrammingAssignmentIds.clear();
  closeProgrammingCopy();
  renderProgrammingCalendar();
}

function prepareProgrammingWeekCopy(sourceWeekValue) {
  const sourceWeek = parseProgrammingDate(sourceWeekValue);
  const endValue = formatProgrammingIsoDate(addProgrammingDays(sourceWeek, 6));
  const rows = getCopyableAssignments().filter(row => row.assignment.assigned_date >= sourceWeekValue && row.assignment.assigned_date <= endValue);
  if (!rows.length) return showWorkoutMessage("No directly assigned workouts were found in that week.", true);
  selectProgrammingAssignments(rows);
  openProgrammingCopy(sourceWeek, addProgrammingDays(sourceWeek, 7), "week");
}

function prepareProgrammingMonthCopy() {
  const rows = getVisibleMonthAssignments().filter(row => row.isDirect);
  if (!rows.length) return showWorkoutMessage("No directly assigned workouts were found in this month.", true);
  selectProgrammingAssignments(rows);
  openProgrammingCopy(programmingMonth, addProgrammingMonths(programmingMonth, 1), "month");
}

function prepareSelectedProgrammingCopy() {
  const rows = getCopyableAssignments().filter(row => selectedProgrammingAssignmentIds.has(row.assignment.id));
  if (!rows.length) return showWorkoutMessage("Select one or more directly assigned workouts first.", true);
  const earliest = rows.reduce((minimum, row) => row.assignment.assigned_date < minimum ? row.assignment.assigned_date : minimum, rows[0].assignment.assigned_date);
  const source = parseProgrammingDate(earliest);
  openProgrammingCopy(source, addProgrammingDays(source, 7), "selection");
}

function openProgrammingCopy(sourceStart, suggestedDestination, mode) {
  const form = document.getElementById("programming-copy-form");
  const date = document.getElementById("programming-copy-date");
  const label = document.getElementById("programming-copy-date-label");
  const help = document.getElementById("programming-copy-help");
  if (!form || !date || !label || !help) return;
  programmingCopySourceStart = sourceStart;
  date.value = formatProgrammingIsoDate(suggestedDestination);
  label.textContent = mode === "week" ? "Copy To Week Starting" : mode === "month" ? "Copy To Month Starting" : "Copy Selection Starting On";
  help.textContent = `${selectedProgrammingAssignmentIds.size} workout${selectedProgrammingAssignmentIds.size === 1 ? "" : "s"} selected. Dates keep the same spacing, and every copy remains independently editable.`;
  form.classList.remove("hidden");
  date.focus();
}

function closeProgrammingCopy() {
  programmingCopySourceStart = null;
  document.getElementById("programming-copy-form")?.classList.add("hidden");
}

async function copyProgrammingAssignments() {
  const destinationValue = document.getElementById("programming-copy-date")?.value || "";
  if (!selectedProgrammingAssignmentIds.size || !programmingCopySourceStart || !destinationValue) {
    return showWorkoutMessage("Choose workouts and a destination date.", true);
  }

  const sourceValue = formatProgrammingIsoDate(programmingCopySourceStart);
  const destinationDate = parseProgrammingDate(destinationValue);
  const scopeName = document.getElementById("programming-scope-id")?.selectedOptions?.[0]?.textContent || "this schedule";
  if (!window.confirm(`Copy ${selectedProgrammingAssignmentIds.size} selected workout${selectedProgrammingAssignmentIds.size === 1 ? "" : "s"} for ${scopeName}, starting ${formatDisplayDate(destinationValue)}?`)) return;

  const button = document.getElementById("confirm-copy-programming");
  button.disabled = true;
  button.textContent = "Copying...";
  try {
    const { data, error } = await db.rpc("copy_workout_programming_assignments", {
      check_assignment_ids: [...selectedProgrammingAssignmentIds],
      check_source_start: sourceValue,
      check_destination_start: destinationValue
    });
    if (error) throw error;
    closeProgrammingCopy();
    selectedProgrammingAssignmentIds.clear();
    await loadRecentWorkouts();
    programmingMonth = getProgrammingMonthStart(destinationDate);
    renderProgrammingCalendar();
    showWorkoutMessage(`${data} workout${Number(data) === 1 ? "" : "s"} copied to the schedule.`);
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not copy the selected programming.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Confirm Copy";
  }
}

function moveProgrammingMonth(offset) {
  programmingMonth = addProgrammingMonths(programmingMonth, offset);
  selectedProgrammingAssignmentIds.clear();
  closeProgrammingCopy();
  renderProgrammingCalendar();
}

function initProgrammingCalendar() {
  document.querySelectorAll("[data-programming-view]").forEach(button => {
    button.addEventListener("click", () => setProgrammingView(button.dataset.programmingView));
  });
  document.getElementById("programming-scope-type")?.addEventListener("change", renderProgrammingScopeOptions);
  document.getElementById("programming-scope-id")?.addEventListener("change", clearProgrammingSelection);
  document.getElementById("programming-previous-month")?.addEventListener("click", () => moveProgrammingMonth(-1));
  document.getElementById("programming-next-month")?.addEventListener("click", () => moveProgrammingMonth(1));
  document.getElementById("programming-current-month")?.addEventListener("click", () => {
    programmingMonth = getProgrammingMonthStart(new Date());
    selectedProgrammingAssignmentIds.clear();
    closeProgrammingCopy();
    renderProgrammingCalendar();
  });
  document.getElementById("copy-programming-month")?.addEventListener("click", prepareProgrammingMonthCopy);
  document.getElementById("copy-programming-selected")?.addEventListener("click", prepareSelectedProgrammingCopy);
  document.getElementById("clear-programming-selection")?.addEventListener("click", clearProgrammingSelection);
  document.getElementById("cancel-copy-programming")?.addEventListener("click", closeProgrammingCopy);
  document.getElementById("confirm-copy-programming")?.addEventListener("click", copyProgrammingAssignments);
}
