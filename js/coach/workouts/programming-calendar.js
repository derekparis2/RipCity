// =====================================================
// COACH PROGRAMMING CALENDAR
// =====================================================
// Presents normal workout assignments in one month view. Individual schedules
// combine direct, group, and facility assignments; only direct assignments are
// selectable for copying so inherited work is never duplicated accidentally.

let programmingMonth = getProgrammingMonthStart(new Date());
let selectedProgrammingAssignmentIds = new Set();
let programmingCopySourceStart = null;
let programmingCopyDestinations = [];
let activeProgrammingWorkoutRow = null;

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
  const createProgram = document.getElementById("create-program-from-selection");
  if (copySelected) {
    copySelected.disabled = selectedCount === 0;
    copySelected.textContent = selectedCount ? `Copy Selected (${selectedCount})` : "Copy Selected";
  }
  if (clear) clear.disabled = selectedCount === 0;
  if (createProgram) createProgram.disabled = selectedCount === 0;
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
              <button type="button" data-calendar-workout="${window.RipCityUI.attr(row.workout.id)}" data-calendar-workout-assignment="${window.RipCityUI.attr(row.assignment.id)}">
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
      activeProgrammingWorkoutRow = getProgrammingAssignments().find(row => row.assignment.id === button.dataset.calendarWorkoutAssignment) || null;
      openProgrammingWorkoutActions();
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
  const help = document.getElementById("programming-copy-help");
  if (!form || !help) return;
  programmingCopySourceStart = sourceStart;
  programmingCopyDestinations = [{
    key: `destination-${Date.now()}`,
    target_type: document.getElementById("programming-scope-type")?.value || "group",
    target_id: document.getElementById("programming-scope-id")?.value || "",
    destination_start: formatProgrammingIsoDate(suggestedDestination)
  }];
  help.textContent = `${selectedProgrammingAssignmentIds.size} workout${selectedProgrammingAssignmentIds.size === 1 ? "" : "s"} selected from this ${mode}. Add any groups, members, weeks, or months that should receive independent copies.`;
  renderProgrammingCopyDestinations();
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeProgrammingCopy() {
  programmingCopySourceStart = null;
  programmingCopyDestinations = [];
  document.getElementById("programming-copy-form")?.classList.add("hidden");
}

function getProgrammingDestinationOptions(type, selectedId = "") {
  const options = type === "group"
    ? availableGroups.map(group => ({ id: group.id, label: group.name }))
    : availableMembers.map(member => ({ id: member.memberProfileId, label: `${member.name} · ${getMemberGroupNames(member.memberProfileId).join(", ") || "No group"}` }));
  return options.map(option => `<option value="${window.RipCityUI.attr(option.id)}" ${option.id === selectedId ? "selected" : ""}>${window.RipCityUI.text(option.label)}</option>`).join("");
}

function addProgrammingDestination() {
  const last = programmingCopyDestinations.at(-1);
  const nextDate = last?.destination_start ? formatProgrammingIsoDate(addProgrammingMonths(parseProgrammingDate(last.destination_start), 1)) : formatProgrammingIsoDate(programmingMonth);
  programmingCopyDestinations.push({
    key: `destination-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    target_type: last?.target_type || "group",
    target_id: last?.target_id || availableGroups[0]?.id || "",
    destination_start: nextDate
  });
  renderProgrammingCopyDestinations();
}

function getSelectedProgrammingRows() {
  return getCopyableAssignments().filter(row => selectedProgrammingAssignmentIds.has(row.assignment.id));
}

function getProgrammingCopyPreview() {
  const selectedRows = getSelectedProgrammingRows();
  const existingRows = recentWorkoutRows.flatMap(workout => (workout.workout_assignments || []).map(assignment => ({ workout, assignment })));
  const plannedKeys = new Map();
  const rows = programmingCopyDestinations.flatMap(destination => selectedRows.map(row => {
    const dayOffset = Math.round((parseProgrammingDate(row.assignment.assigned_date) - programmingCopySourceStart) / 86400000);
    const assignedDate = formatProgrammingIsoDate(addProgrammingDays(parseProgrammingDate(destination.destination_start), dayOffset));
    const target = destination.target_type === "group"
      ? availableGroups.find(group => group.id === destination.target_id)?.name
      : availableMembers.find(member => member.memberProfileId === destination.target_id)?.name;
    const existingConflict = existingRows.some(existing => existing.assignment.assigned_date === assignedDate
      && existing.assignment.target_type === destination.target_type
      && (destination.target_type === "group"
        ? existing.assignment.target_group_id === destination.target_id
        : existing.assignment.target_member_profile_id === destination.target_id));
    const plannedKey = `${destination.target_type}:${destination.target_id}:${assignedDate}`;
    plannedKeys.set(plannedKey, (plannedKeys.get(plannedKey) || 0) + 1);
    return { destination, workout: row.workout, assignedDate, target: target || "Choose a roster", existingConflict, plannedKey };
  }));
  return rows.map(row => ({
    ...row,
    duplicateConflict: (plannedKeys.get(row.plannedKey) || 0) > 1,
    conflict: row.existingConflict || (plannedKeys.get(row.plannedKey) || 0) > 1
  }));
}

function renderProgrammingCopyDestinations() {
  const list = document.getElementById("programming-copy-destinations");
  const preview = document.getElementById("programming-copy-preview");
  const confirm = document.getElementById("confirm-copy-programming");
  if (!list || !preview || !confirm) return;
  list.innerHTML = programmingCopyDestinations.map((destination, index) => `
    <article class="programming-copy-destination" data-copy-destination="${window.RipCityUI.attr(destination.key)}">
      <strong>Destination ${index + 1}</strong>
      <label>Roster Type<select data-copy-destination-field="target_type"><option value="group" ${destination.target_type === "group" ? "selected" : ""}>Group</option><option value="member" ${destination.target_type === "member" ? "selected" : ""}>Individual member</option></select></label>
      <label>Roster<select data-copy-destination-field="target_id">${getProgrammingDestinationOptions(destination.target_type, destination.target_id)}</select></label>
      <label>Paste Starting<input type="date" data-copy-destination-field="destination_start" value="${window.RipCityUI.attr(destination.destination_start)}" /></label>
      <button class="outline-btn small-inline-btn danger-outline-btn" type="button" data-remove-copy-destination ${programmingCopyDestinations.length === 1 ? "disabled" : ""}>Remove</button>
    </article>
  `).join("");
  list.querySelectorAll("[data-copy-destination]").forEach(row => {
    const destination = programmingCopyDestinations.find(item => item.key === row.dataset.copyDestination);
    row.querySelectorAll("[data-copy-destination-field]").forEach(field => field.addEventListener("change", () => {
      destination[field.dataset.copyDestinationField] = field.value;
      if (field.dataset.copyDestinationField === "target_type") {
        destination.target_id = field.value === "group" ? availableGroups[0]?.id || "" : availableMembers[0]?.memberProfileId || "";
      }
      renderProgrammingCopyDestinations();
    }));
    row.querySelector("[data-remove-copy-destination]")?.addEventListener("click", () => {
      programmingCopyDestinations = programmingCopyDestinations.filter(item => item.key !== destination.key);
      renderProgrammingCopyDestinations();
    });
  });
  const rows = getProgrammingCopyPreview();
  const conflicts = rows.filter(row => row.conflict).length;
  preview.innerHTML = `
    <div class="programming-copy-preview-summary"><strong>${rows.length} workout assignment${rows.length === 1 ? "" : "s"} will be created</strong><span class="${conflicts ? "has-conflict" : ""}">${conflicts ? `${conflicts} conflict${conflicts === 1 ? "" : "s"} must be resolved` : "No schedule conflicts"}</span></div>
    <div class="programming-copy-preview-list">${rows.map(row => `<span class="${row.conflict ? "has-conflict" : ""}"><strong>${window.RipCityUI.text(row.workout.title)}</strong> → ${window.RipCityUI.text(row.target)} · ${window.RipCityUI.text(formatDisplayDate(row.assignedDate))}${row.existingConflict ? " · already has a workout" : row.duplicateConflict ? " · duplicated in this copy plan" : ""}</span>`).join("")}</div>`;
  confirm.disabled = !rows.length || conflicts > 0 || programmingCopyDestinations.some(destination => !destination.target_id || !destination.destination_start);
}

async function copyProgrammingAssignments() {
  if (!selectedProgrammingAssignmentIds.size || !programmingCopySourceStart || !programmingCopyDestinations.length) {
    return showWorkoutMessage("Choose workouts and at least one destination.", true);
  }

  const sourceValue = formatProgrammingIsoDate(programmingCopySourceStart);
  const previewRows = getProgrammingCopyPreview();
  if (previewRows.some(row => row.conflict)) return showWorkoutMessage("Resolve the destination conflicts before copying.", true);
  if (!window.confirm(`Create ${previewRows.length} independent workout assignment${previewRows.length === 1 ? "" : "s"} across ${programmingCopyDestinations.length} destination${programmingCopyDestinations.length === 1 ? "" : "s"}?`)) return;

  const button = document.getElementById("confirm-copy-programming");
  button.disabled = true;
  button.textContent = "Copying...";
  try {
    const firstDestinationStart = programmingCopyDestinations[0]?.destination_start || sourceValue;
    const { data, error } = await db.rpc("copy_workout_programming_assignments", {
      check_assignment_ids: [...selectedProgrammingAssignmentIds],
      check_source_start: sourceValue,
      check_destinations: programmingCopyDestinations.map(({ target_type, target_id, destination_start }) => ({ target_type, target_id, destination_start }))
    });
    if (error) throw error;
    closeProgrammingCopy();
    selectedProgrammingAssignmentIds.clear();
    await loadRecentWorkouts();
    programmingMonth = getProgrammingMonthStart(parseProgrammingDate(firstDestinationStart));
    renderProgrammingCalendar();
    const copiedCount = Number(data?.copied_count || 0);
    showWorkoutMessage(`${copiedCount} workout assignment${copiedCount === 1 ? "" : "s"} copied to the schedule.`);
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not copy the selected programming.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Confirm Copy";
  }
}

function createProgramFromProgrammingSelection() {
  const rows = getSelectedProgrammingRows().sort((a, b) => a.assignment.assigned_date.localeCompare(b.assignment.assigned_date));
  if (!rows.length) return showWorkoutMessage("Select one or more directly assigned workouts first.", true);
  const sourceStart = getProgrammingWeekStart(parseProgrammingDate(rows[0].assignment.assigned_date));
  const lastDate = parseProgrammingDate(rows.at(-1).assignment.assigned_date);
  const durationWeeks = Math.floor((getProgrammingWeekStart(lastDate) - sourceStart) / (7 * 86400000)) + 1;
  const scopeName = document.getElementById("programming-scope-id")?.selectedOptions?.[0]?.textContent?.split(" · ")[0] || "New";
  const items = rows.map((row, index) => {
    const date = parseProgrammingDate(row.assignment.assigned_date);
    return {
      source_workout_id: row.workout.id,
      week_number: Math.floor((getProgrammingWeekStart(date) - sourceStart) / (7 * 86400000)) + 1,
      day_of_week: date.getDay() === 0 ? 7 : date.getDay(),
      item_order: index
    };
  });
  setProgrammingView("programs");
  openProgramBuilder(null, { name: `${scopeName} Program`, durationWeeks, items });
}

function openProgrammingWorkoutActions() {
  const panel = document.getElementById("programming-workout-actions");
  const description = document.getElementById("programming-workout-actions-description");
  if (!panel || !description || !activeProgrammingWorkoutRow) return;
  description.textContent = `${activeProgrammingWorkoutRow.workout.title} · ${formatDisplayDate(activeProgrammingWorkoutRow.assignment.assigned_date)} · ${activeProgrammingWorkoutRow.sourceLabel}`;
  document.getElementById("unassign-programming-workout").disabled = !activeProgrammingWorkoutRow.isDirect;
  document.getElementById("delete-programming-workout").disabled = !activeProgrammingWorkoutRow.isDirect;
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeProgrammingWorkoutActions() {
  activeProgrammingWorkoutRow = null;
  document.getElementById("programming-workout-actions")?.classList.add("hidden");
}

async function removeProgrammingWorkout(deleteWorkout) {
  if (!activeProgrammingWorkoutRow?.isDirect) return;
  const verb = deleteWorkout ? "delete this workout and its assignment" : "unassign this workout";
  if (!window.confirm(`Are you sure you want to ${verb}? Started workouts and linked program workouts are protected.`)) return;
  try {
    const { error } = await db.rpc("remove_workout_programming_assignment", {
      check_assignment_id: activeProgrammingWorkoutRow.assignment.id,
      check_delete_workout: deleteWorkout
    });
    if (error) throw error;
    closeProgrammingWorkoutActions();
    await loadRecentWorkouts();
    renderProgrammingCalendar();
    showWorkoutMessage(deleteWorkout ? "Workout deleted from the calendar." : "Workout unassigned from the calendar.");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not change this calendar workout.", true);
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
  document.getElementById("create-program-from-selection")?.addEventListener("click", createProgramFromProgrammingSelection);
  document.getElementById("clear-programming-selection")?.addEventListener("click", clearProgrammingSelection);
  document.getElementById("cancel-copy-programming")?.addEventListener("click", closeProgrammingCopy);
  document.getElementById("add-programming-destination")?.addEventListener("click", addProgrammingDestination);
  document.getElementById("confirm-copy-programming")?.addEventListener("click", copyProgrammingAssignments);
  document.getElementById("close-programming-workout-actions")?.addEventListener("click", closeProgrammingWorkoutActions);
  document.getElementById("edit-programming-workout")?.addEventListener("click", () => activeProgrammingWorkoutRow && openWorkoutInBuilder(activeProgrammingWorkoutRow.workout));
  document.getElementById("unassign-programming-workout")?.addEventListener("click", () => removeProgrammingWorkout(false));
  document.getElementById("delete-programming-workout")?.addEventListener("click", () => removeProgrammingWorkout(true));
}
