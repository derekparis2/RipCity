// =====================================================
// COACH WORKOUT ASSIGNMENTS
// =====================================================
// Owns assignment targets, duplicate prevention, assignment actions, and
// assignment labels for both newly created and existing workouts.

function renderAllGroupOptions() {
  return availableGroups.map(group => `
    <option value="${window.RipCityUI.attr(group.id)}">
      ${window.RipCityUI.text(group.name)} · ${window.RipCityUI.text(group.member_type)}
    </option>
  `).join("");
}

function renderAllMemberOptions() {
  return availableMembers.map(member => {
    const groupNames = getMemberGroupNames(member.memberProfileId);
    const groupLabel = groupNames.length ? ` · ${groupNames.join(", ")}` : " · No group";

    return `
      <option value="${window.RipCityUI.attr(member.memberProfileId)}">
        ${window.RipCityUI.text(member.name)} · ${window.RipCityUI.text(member.memberType)}${member.sport ? ` · ${window.RipCityUI.text(member.sport)}` : ""}${window.RipCityUI.text(groupLabel)}
      </option>
    `;
  }).join("");
}

function updateAssignmentControls() {
  const targetType = getInputValue("workout-target-type") || "group";
  const groupField = document.getElementById("workout-group-field");
  const memberField = document.getElementById("workout-member-field");
  const groupList = document.getElementById("workout-group");
  const memberSelect = document.getElementById("workout-member");

  groupField?.classList.toggle("hidden", targetType !== "group");
  memberField?.classList.toggle("hidden", targetType !== "member");

  if (groupList) {
    const isGroupTarget = targetType === "group";
    groupList.classList.toggle("is-disabled", !isGroupTarget);

    if (!isGroupTarget) {
      groupList.querySelectorAll("input[type='checkbox']").forEach(input => {
        input.checked = false;
      });
    }
  }

  if (memberSelect) {
    const isMemberTarget = targetType === "member";
    memberSelect.required = isMemberTarget;
    memberSelect.disabled = !isMemberTarget;

    if (!isMemberTarget) {
      memberSelect.value = "";
    }
  }

}

function refreshAssignmentOptions() {
  renderGroupOptions();
  renderMemberOptions();
  updateAssignmentControls();
}

let selectedWorkoutDates = [];

function getWorkoutAssignedDates() {
  const pendingDate = getInputValue("workout-date");
  return [...new Set([...selectedWorkoutDates, pendingDate].filter(Boolean))].sort();
}

function renderSelectedWorkoutDates() {
  const container = document.getElementById("workout-selected-dates");
  if (!container) return;

  container.innerHTML = selectedWorkoutDates.length
    ? selectedWorkoutDates.map(date => `
        <span class="workout-date-chip">
          ${window.RipCityUI.text(formatDisplayDate(date))}
          <button type="button" aria-label="Remove ${window.RipCityUI.attr(formatDisplayDate(date))}" data-remove-workout-date="${window.RipCityUI.attr(date)}">&times;</button>
        </span>
      `).join("")
    : `<span class="muted-small">One date selected unless you add more.</span>`;

  container.querySelectorAll("[data-remove-workout-date]").forEach(button => {
    button.addEventListener("click", () => {
      selectedWorkoutDates = selectedWorkoutDates.filter(date => date !== button.dataset.removeWorkoutDate);
      renderSelectedWorkoutDates();
      updateWorkoutBuilderReview();
    });
  });
}

function addSelectedWorkoutDate() {
  const date = getInputValue("workout-date");
  if (!date) {
    showWorkoutValidationError("Choose a date before adding it.", document.getElementById("workout-date"));
    return;
  }

  if (!selectedWorkoutDates.includes(date)) selectedWorkoutDates.push(date);
  selectedWorkoutDates.sort();
  const input = document.getElementById("workout-date");
  if (input) input.value = "";
  renderSelectedWorkoutDates();
  updateWorkoutBuilderReview();
}

function resetSelectedWorkoutDates() {
  selectedWorkoutDates = [];
  renderSelectedWorkoutDates();
}

function buildAssignmentRows({ workoutId, targetType, groupIds = [], memberProfileId = "", assignedDate, assignedDates = [] }) {
  const dates = [...new Set([...(assignedDates || []), assignedDate].filter(Boolean))];

  return dates.flatMap(date => {
    const baseRow = {
      workout_id: workoutId,
      assigned_by: workoutCoachAccess.profile.id,
      assigned_date: date
    };

    if (targetType === "facility") {
      return [{
      ...baseRow,
      target_type: "facility",
      target_facility_id: workoutCoachAccess.membership.facility_id,
      target_group_id: null,
      target_member_profile_id: null
      }];
    }

    if (targetType === "member") {
      return [{
      ...baseRow,
      target_type: "member",
      target_facility_id: null,
      target_group_id: null,
      target_member_profile_id: memberProfileId
      }];
    }

    return groupIds.map(groupId => ({
      ...baseRow,
      target_type: "group",
      target_facility_id: null,
      target_group_id: groupId,
      target_member_profile_id: null
    }));
  });
}

function getAssignmentKey(assignment) {
  return [
    assignment.assigned_date,
    assignment.target_type,
    assignment.target_facility_id || "",
    assignment.target_group_id || "",
    assignment.target_member_profile_id || ""
  ].join("|");
}

function filterDuplicateAssignmentRows(rows, existingAssignments = []) {
  const existingKeys = new Set(existingAssignments.map(getAssignmentKey));
  return rows.filter(row => !existingKeys.has(getAssignmentKey(row)));
}

function getTargetLabelForDraft(targetType, groupIds = [], memberProfileId = "") {
  if (targetType === "facility") {
    return "Entire Facility";
  }

  if (targetType === "member") {
    const member = availableMembers.find(row => row.memberProfileId === memberProfileId);
    return member ? member.name : "Selected member";
  }

  const selectedGroups = availableGroups.filter(group => groupIds.includes(group.id));

  if (selectedGroups.length === 1) {
    return selectedGroups[0].name;
  }

  return `${selectedGroups.length} groups`;
}

function getAssignmentSuccessMessage({ title, targetType, groupIds, memberProfileId, assignedDate, assignedDates = [] }) {
  const targetLabel = getTargetLabelForDraft(targetType, groupIds, memberProfileId);
  const dates = [...new Set([...(assignedDates || []), assignedDate].filter(Boolean))];
  const dateLabel = dates.length === 1 ? formatDisplayDate(dates[0]) : `${dates.length} dates`;
  return `Workout "${title}" created and assigned to ${targetLabel} for ${dateLabel}.`;
}

function confirmWorkoutCreate({ title, targetType, groupIds, memberProfileId, assignedDate, assignedDates = [] }) {
  const targetLabel = getTargetLabelForDraft(targetType, groupIds, memberProfileId);
  const dates = [...new Set([...(assignedDates || []), assignedDate].filter(Boolean))];

  return window.confirm(
    [
      "Create and assign this workout?",
      "",
      `Title: ${title}`,
      `Date${dates.length === 1 ? "" : "s"}: ${dates.map(formatDisplayDate).join(", ")}`,
      `Assigned to: ${targetLabel}`
    ].join("\n")
  );
}

async function removeWorkoutAssignment(assignmentId) {
  const assignment = recentWorkoutRows
    .flatMap(workout => (workout.workout_assignments || []).map(row => ({ ...row, workout })))
    .find(row => row.id === assignmentId);

  if (!assignment) return;

  const logWarning = await getAssignmentLogWarning(assignmentId);
  const confirmed = window.confirm(
    [
      "Remove this assignment?",
      "",
      `Workout: ${assignment.workout.title}`,
      `Date: ${formatDisplayDate(assignment.assigned_date)}`,
      `Assigned to: ${getAssignmentTargetLabel(assignment)}`,
      "",
      "The workout will stay saved and can be assigned again later.",
      logWarning
    ].filter(Boolean).join("\n")
  );

  if (!confirmed) return;

  showWorkoutMessage("Removing assignment...");

  try {
    const { error } = await db
      .from("workout_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) throw error;

    showWorkoutMessage("Assignment removed. The workout is still saved.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not remove assignment.", true);
  }
}

async function getAssignmentLogWarning(assignmentId) {
  try {
    const { count, error } = await db
      .from("exercise_set_logs")
      .select("id", { count: "exact", head: true })
      .eq("workout_assignment_id", assignmentId);

    if (error || !count) return "";

    return `Warning: this also removes ${count} saved set log${count === 1 ? "" : "s"} for this assignment.`;
  } catch (error) {
    console.error(error);
    return "";
  }
}

function updateRecentAssignmentControls(workoutId) {
  const targetType = document.querySelector(`[data-reuse-target-type="${workoutId}"]`)?.value || "group";
  const groupField = document.querySelector(`[data-reuse-group-field="${workoutId}"]`);
  const memberField = document.querySelector(`[data-reuse-member-field="${workoutId}"]`);
  const groupSelect = document.querySelector(`[data-reuse-groups="${workoutId}"]`);
  const memberSelect = document.querySelector(`[data-reuse-member="${workoutId}"]`);

  groupField?.classList.toggle("hidden", targetType !== "group");
  memberField?.classList.toggle("hidden", targetType !== "member");

  if (groupSelect) {
    groupSelect.disabled = targetType !== "group";
    if (targetType !== "group") {
      Array.from(groupSelect.options).forEach(option => {
        option.selected = false;
      });
    }
  }

  if (memberSelect) {
    memberSelect.disabled = targetType !== "member";
    if (targetType !== "member") {
      memberSelect.value = "";
    }
  }
}

async function assignExistingWorkout(workout) {
  if (!workout) return;

  const workoutId = workout.id;
  const targetType = document.querySelector(`[data-reuse-target-type="${workoutId}"]`)?.value || "group";
  const assignedDates = getExistingWorkoutDates(workoutId);
  const assignedDate = assignedDates[0] || "";
  const groupIds = Array.from(document.querySelector(`[data-reuse-groups="${workoutId}"]`)?.selectedOptions || [])
    .map(option => option.value)
    .filter(Boolean);
  const memberProfileId = document.querySelector(`[data-reuse-member="${workoutId}"]`)?.value || "";

  if (!assignedDate) {
    showWorkoutMessage("Choose an assigned date before reusing the workout.", true);
    return;
  }

  if (targetType === "group" && !groupIds.length) {
    showWorkoutMessage("Choose at least one group before reusing the workout.", true);
    return;
  }

  if (targetType === "member" && !memberProfileId) {
    showWorkoutMessage("Choose a member before reusing the workout.", true);
    return;
  }

  const assignmentRows = buildAssignmentRows({
    workoutId,
    targetType,
    groupIds,
    memberProfileId,
    assignedDate,
    assignedDates
  });
  const rowsToInsert = filterDuplicateAssignmentRows(assignmentRows, workout.workout_assignments || []);

  if (!rowsToInsert.length) {
    showWorkoutMessage("That workout is already assigned to the selected target for that date.", true);
    return;
  }

  showWorkoutMessage("Assigning existing workout...");

  try {
    const { error } = await db
      .from("workout_assignments")
      .insert(rowsToInsert);

    if (error) throw error;

    showWorkoutMessage("Existing workout assigned.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not assign existing workout.", true);
  }
}

function getExistingWorkoutDates(workoutId) {
  const pendingDate = document.querySelector(`[data-reuse-date="${workoutId}"]`)?.value || "";
  const container = document.querySelector(`[data-reuse-selected-dates="${workoutId}"]`);
  const addedDates = Array.from(container?.querySelectorAll("[data-reuse-date-value]") || [])
    .map(element => element.dataset.reuseDateValue)
    .filter(Boolean);
  return [...new Set([...addedDates, pendingDate].filter(Boolean))].sort();
}

function addExistingWorkoutDate(workoutId) {
  const input = document.querySelector(`[data-reuse-date="${workoutId}"]`);
  const container = document.querySelector(`[data-reuse-selected-dates="${workoutId}"]`);
  const date = input?.value || "";
  if (!date || !container) {
    showWorkoutMessage("Choose a date before adding it.", true);
    return;
  }

  const existingDates = getExistingWorkoutDates(workoutId);
  if (!existingDates.includes(date) || !container.querySelector(`[data-reuse-date-value="${date}"]`)) {
    const chip = document.createElement("span");
    chip.className = "workout-date-chip";
    chip.dataset.reuseDateValue = date;
    chip.innerHTML = `${window.RipCityUI.text(formatDisplayDate(date))}<button type="button" aria-label="Remove ${window.RipCityUI.attr(formatDisplayDate(date))}">&times;</button>`;
    chip.querySelector("button")?.addEventListener("click", () => chip.remove());
    if (container.querySelector(".muted-small")) container.innerHTML = "";
    container.appendChild(chip);
    if (input) input.value = "";
  }
}

function getAssignmentTargetLabel(assignment) {
  if (!assignment) return "Unassigned";

  if (assignment.target_type === "facility") {
    return "Entire Facility";
  }

  if (assignment.target_type === "member") {
    const member = availableMembers.find(row =>
      row.memberProfileId === assignment.target_member_profile_id
    );

    return member ? member.name : "Individual Member";
  }

  const group = availableGroups.find(g => g.id === assignment.target_group_id);
  return group?.name || "Group";
}

// ----------------------------
// Logout / init
// ----------------------------
