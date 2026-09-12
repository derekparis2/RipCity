// =====================================================
// COACH WORKOUTS PAGE CONTROLLER
// =====================================================
// Remaining page behavior is being separated into builder, assignment, and
// history modules without changing the current workflow.

function renderExerciseLibraryList() {
  const list = document.getElementById("exercise-library-list");
  const count = document.getElementById("exercise-library-count");
  if (!list) return;

  if (!exerciseLibraryAvailable) {
    if (count) count.textContent = "Exercise library migration not detected.";
    list.innerHTML = `
      <div class="empty-state">
        Exercise library tables are not installed yet. Coaches can keep typing exercises manually.
      </div>
    `;
    return;
  }

  if (!exerciseTemplates.length) {
    if (count) count.textContent = "No saved exercises yet.";
    list.innerHTML = `<div class="empty-state">No library exercises yet. Save one above.</div>`;
    return;
  }

  renderExerciseLibraryFilters();

  const filteredTemplates = getFilteredExerciseTemplates();
  const hasActiveSearch = Boolean(
    getInputValue("exercise-library-search") ||
    getInputValue("exercise-library-category-filter") !== "all" ||
    getInputValue("exercise-library-input-filter") !== "all"
  );
  const visibleTemplates = hasActiveSearch
    ? filteredTemplates
    : filteredTemplates.slice(0, 4);

  if (count) {
    count.textContent = hasActiveSearch
      ? `${filteredTemplates.length} of ${exerciseTemplates.length} exercises shown.`
      : `Showing ${visibleTemplates.length} recent exercises. Search or filter to edit the full library.`;
  }

  if (!filteredTemplates.length) {
    list.innerHTML = `<div class="empty-state">No exercises match that search.</div>`;
    return;
  }

  list.innerHTML = visibleTemplates.map(template => `
    <article class="exercise-library-card">
      <div>
        <h4>${window.RipCityUI.text(template.name)}</h4>
        <p>${window.RipCityUI.text(template.description, "No cues added.")}</p>
      </div>

      <div class="workout-meta-row">
        <span>${window.RipCityUI.text(formatInputTypeLabel(template.input_type))}</span>
        ${template.category ? `<span>${window.RipCityUI.text(template.category)}</span>` : ""}
        ${template.equipment ? `<span>${window.RipCityUI.text(template.equipment)}</span>` : ""}
      </div>

      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-add-template-to-builder="${window.RipCityUI.attr(template.id)}"
      >
        Add
      </button>

      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-toggle-template-edit="${window.RipCityUI.attr(template.id)}"
      >
        Edit
      </button>

      <form class="exercise-template-edit-form hidden" data-template-edit-form="${window.RipCityUI.attr(template.id)}">
        <label>
          Exercise Name
          <input type="text" value="${window.RipCityUI.attr(template.name || "")}" data-template-edit-name required />
        </label>

        <div class="form-row">
          <label>
            Category
            <input type="text" value="${window.RipCityUI.attr(template.category || "")}" data-template-edit-category />
          </label>

          <label>
            Equipment
            <input type="text" value="${window.RipCityUI.attr(template.equipment || "")}" data-template-edit-equipment />
          </label>
        </div>

        <label>
          Default Input Type
          <select data-template-edit-input-type>
            <option value="completion" ${template.input_type === "completion" ? "selected" : ""}>Completion</option>
            <option value="weight_reps" ${template.input_type === "weight_reps" ? "selected" : ""}>Weight + Reps</option>
            <option value="band_color" ${template.input_type === "band_color" ? "selected" : ""}>Band Color</option>
            <option value="time" ${template.input_type === "time" ? "selected" : ""}>Time</option>
            <option value="distance" ${template.input_type === "distance" ? "selected" : ""}>Distance</option>
            <option value="custom" ${template.input_type === "custom" ? "selected" : ""}>Custom</option>
          </select>
        </label>

        <label>
          Description / Cues
          <textarea rows="3" data-template-edit-description>${window.RipCityUI.text(template.description || "")}</textarea>
        </label>

        <label>
          Demo Video URL
          <input type="text" value="${window.RipCityUI.attr(template.video_url || "")}" data-template-edit-video />
        </label>

        <label>
          Default Coach Note
          <textarea rows="2" data-template-edit-coach-note>${window.RipCityUI.text(template.coach_note || "")}</textarea>
        </label>

        <div class="exercise-template-edit-actions">
          <button class="primary-btn small-inline-btn" type="submit">Save Exercise</button>
          <button class="outline-btn small-inline-btn" type="button" data-cancel-template-edit="${window.RipCityUI.attr(template.id)}">Cancel</button>
        </div>
      </form>
    </article>
  `).join("");

  list.querySelectorAll("[data-add-template-to-builder]").forEach(button => {
    button.addEventListener("click", () => addTemplateToBuilder(button.dataset.addTemplateToBuilder));
  });

  list.querySelectorAll("[data-toggle-template-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-template-edit-form="${button.dataset.toggleTemplateEdit}"]`)
        ?.classList.toggle("hidden");
    });
  });

  list.querySelectorAll("[data-cancel-template-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-template-edit-form="${button.dataset.cancelTemplateEdit}"]`)
        ?.classList.add("hidden");
    });
  });

  list.querySelectorAll("[data-template-edit-form]").forEach(form => {
    form.addEventListener("submit", event => saveExerciseTemplateEdit(event, form.dataset.templateEditForm));
  });
}

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

async function refreshExerciseLibrary() {
  showExerciseLibraryMessage("Loading exercise library...");

  try {
    exerciseTemplates = await loadExerciseTemplates(workoutCoachAccess.membership.facility_id);
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();

    showExerciseLibraryMessage(
      exerciseLibraryAvailable
        ? ""
        : "Run the exercise library migration to enable saved exercises."
    );
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not load exercise library.", true);
    exerciseLibraryAvailable = false;
    exerciseTemplates = [];
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();
  }
}

async function saveExerciseTemplate(event) {
  event.preventDefault();

  if (!exerciseLibraryAvailable) {
    showExerciseLibraryMessage("Run the exercise library migration before saving templates.", true);
    return;
  }

  const name = getInputValue("library-exercise-name");

  if (!name) {
    showExerciseLibraryMessage("Exercise name is required.", true);
    return;
  }

  showExerciseLibraryMessage("Saving exercise...");

  try {
    const { error } = await db
      .from("exercise_templates")
      .insert({
        facility_id: workoutCoachAccess.membership.facility_id,
        created_by: workoutCoachAccess.profile.id,
        name,
        category: getInputValue("library-exercise-category") || null,
        equipment: getInputValue("library-exercise-equipment") || null,
        input_type: getInputValue("library-exercise-input-type") || "completion",
        description: getInputValue("library-exercise-description") || null,
        video_url: getInputValue("library-exercise-video") || null,
        coach_note: getInputValue("library-exercise-coach-note") || null
      });

    if (error) throw error;

    document.getElementById("exercise-library-form").reset();
    await refreshExerciseLibrary();
    showExerciseLibraryMessage("Exercise saved.");
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not save exercise.", true);
  }
}

async function saveExerciseTemplateEdit(event, templateId) {
  event.preventDefault();

  const form = event.currentTarget;
  const name = form.querySelector("[data-template-edit-name]").value.trim();

  if (!name) {
    showExerciseLibraryMessage("Exercise name is required.", true);
    return;
  }

  showExerciseLibraryMessage("Saving exercise...");

  try {
    const { error } = await db
      .from("exercise_templates")
      .update({
        name,
        category: form.querySelector("[data-template-edit-category]").value.trim() || null,
        equipment: form.querySelector("[data-template-edit-equipment]").value.trim() || null,
        input_type: form.querySelector("[data-template-edit-input-type]").value || "completion",
        description: form.querySelector("[data-template-edit-description]").value.trim() || null,
        video_url: form.querySelector("[data-template-edit-video]").value.trim() || null,
        coach_note: form.querySelector("[data-template-edit-coach-note]").value.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", templateId)
      .eq("facility_id", workoutCoachAccess.membership.facility_id);

    if (error) throw error;

    await refreshExerciseLibrary();
    showExerciseLibraryMessage("Exercise updated.");
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not update exercise.", true);
  }
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

async function createTemplateFromWorkoutExercise(exercise) {
  const templateId = createClientId();
  const { error } = await db
    .from("exercise_templates")
    .insert({
      id: templateId,
      facility_id: workoutCoachAccess.membership.facility_id,
      created_by: workoutCoachAccess.profile.id,
      name: exercise.name,
      input_type: exercise.input_type || "completion",
      description: exercise.description,
      video_url: exercise.video_url,
      coach_note: exercise.coach_note
    });

  if (error) throw error;

  return {
    id: templateId,
    facility_id: workoutCoachAccess.membership.facility_id,
    name: exercise.name,
    input_type: exercise.input_type || "completion",
    description: exercise.description,
    video_url: exercise.video_url,
    coach_note: exercise.coach_note
  };
}

async function ensureWorkoutExercisesAreInLibrary(blocks) {
  if (!exerciseLibraryAvailable) return blocks;

  // Before a workout is saved, attach every exercise to an existing template
  // or create a facility-owned template for custom coach entries. That keeps
  // the library useful without forcing coaches to leave the builder flow.
  const templatesByName = new Map(
    exerciseTemplates.map(template => [normalizeExerciseName(template.name), template])
  );
  const createdTemplates = [];

  for (const block of blocks) {
    for (const exercise of block.exercises) {
      if (exercise.exercise_template_id) continue;

      const normalizedName = normalizeExerciseName(exercise.name);
      if (!normalizedName) continue;

      const existingTemplate = templatesByName.get(normalizedName);
      if (existingTemplate) {
        exercise.exercise_template_id = existingTemplate.id;
        continue;
      }

      try {
        const createdTemplate = await createTemplateFromWorkoutExercise(exercise);
        templatesByName.set(normalizedName, createdTemplate);
        createdTemplates.push(createdTemplate);
        exercise.exercise_template_id = createdTemplate.id;
      } catch (error) {
        // If another coach added the same exercise first, refresh and attach it.
        // Other errors should still stop the workout save so the coach sees them.
        if (error?.code !== "23505") throw error;

        exerciseTemplates = await loadExerciseTemplates(workoutCoachAccess.membership.facility_id);
        const duplicateTemplate = findExerciseTemplateByName(exercise.name);
        if (!duplicateTemplate) throw error;

        templatesByName.set(normalizedName, duplicateTemplate);
        exercise.exercise_template_id = duplicateTemplate.id;
      }
    }
  }

  if (createdTemplates.length) {
    exerciseTemplates = [...exerciseTemplates, ...createdTemplates]
      .sort((a, b) => a.name.localeCompare(b.name));
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();
  }

  return blocks;
}

function buildAssignmentRows({ workoutId, targetType, groupIds = [], memberProfileId = "", assignedDate }) {
  const baseRow = {
    workout_id: workoutId,
    assigned_by: workoutCoachAccess.profile.id,
    assigned_date: assignedDate
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

function getAssignmentSuccessMessage({ title, targetType, groupIds, memberProfileId, assignedDate }) {
  const targetLabel = getTargetLabelForDraft(targetType, groupIds, memberProfileId);
  return `Workout "${title}" created and assigned to ${targetLabel} for ${formatDisplayDate(assignedDate)}.`;
}

function confirmWorkoutCreate({ title, targetType, groupIds, memberProfileId, assignedDate }) {
  const targetLabel = getTargetLabelForDraft(targetType, groupIds, memberProfileId);

  return window.confirm(
    [
      "Create and assign this workout?",
      "",
      `Title: ${title}`,
      `Date: ${formatDisplayDate(assignedDate)}`,
      `Assigned to: ${targetLabel}`
    ].join("\n")
  );
}

function buildRecentWorkoutSelect(includeExerciseTemplateColumn = true) {
  const exerciseTemplateColumn = includeExerciseTemplateColumn
    ? "exercise_template_id,"
    : "";

  return `
    id,
    title,
    focus,
    description,
    estimated_minutes,
    created_at,
    workout_blocks (
      id,
      name,
      block_order,
      workout_exercises (
          id,
          name,
          description,
          tempo,
          sets,
          reps,
          rest_time,
          input_type,
          video_url,
          coach_note,
          ${exerciseTemplateColumn}
          exercise_order
      )
    ),
    workout_assignments (
      id,
      assigned_date,
      target_type,
      target_facility_id,
      target_group_id,
      target_member_profile_id
    )
  `;
}

function isMissingExerciseTemplateColumnError(error) {
  return /exercise_template_id/i.test(error?.message || "") ||
    /exercise_template_id/i.test(error?.details || "");
}

async function fetchRecentWorkoutRows(includeExerciseTemplateColumn = true) {
  return db
    .from("workouts")
    .select(buildRecentWorkoutSelect(includeExerciseTemplateColumn))
    .eq("facility_id", workoutCoachAccess.membership.facility_id)
    .order("created_at", { ascending: false })
    .limit(8);
}

// ----------------------------
// Save workout
// ----------------------------

async function createWorkoutWithAssignment(event) {
  event.preventDefault();
  updateAssignmentControls();

  const submitButton = event.submitter || document.querySelector("#workout-form button[type='submit']");
  const originalSubmitText = submitButton?.textContent;

  try {
    const title = getInputValue("workout-title");
    const focus = getInputValue("workout-focus");
    const description = getInputValue("workout-description");
    const minutes = getInputValue("workout-minutes");
    const targetType = getInputValue("workout-target-type") || "group";
    const groupIds = getSelectedValues("workout-group");
    const memberProfileId = getInputValue("workout-member");
    const assignedDate = getInputValue("workout-date");

    if (!title || !assignedDate) {
      showWorkoutMessage("Workout title and assigned date are required.", true);
      return;
    }

    if (targetType === "group" && !groupIds.length) {
      showWorkoutMessage("Choose at least one group for this assignment.", true);
      return;
    }

    if (targetType === "member" && !memberProfileId) {
      showWorkoutMessage("Choose a member for this assignment.", true);
      return;
    }

    const blocks = await ensureWorkoutExercisesAreInLibrary(getBlockFormData());

    if (!blocks.length) {
        showWorkoutMessage("Add at least one block with at least one exercise.", true);
        return;
    }

    if (!confirmWorkoutCreate({ title, targetType, groupIds, memberProfileId, assignedDate })) {
      showWorkoutMessage("Workout creation cancelled.");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    showWorkoutMessage("Creating workout...");

    const workoutId = createClientId();

    // Save order matters: workout -> blocks -> exercises -> assignment.
    // This preserves the relationships expected by member-dashboard/workout-session.
    // IDs are generated client-side so the flow does not rely on INSERT ... RETURNING,
    // which is more fragile under strict RLS policies.
    const { error: workoutError } = await db
      .from("workouts")
      .insert({
        id: workoutId,
        facility_id: workoutCoachAccess.membership.facility_id,
        title,
        focus: focus || null,
        description: description || null,
        estimated_minutes: minutes ? Number(minutes) : null,
        created_by: workoutCoachAccess.profile.id
      });

    if (workoutError) throw workoutError;

    const blockRows = blocks.map(block => ({
        id: createClientId(),
        workout_id: workoutId,
        name: block.name,
        block_order: block.block_order
    }));
    
    const { error: blockError } = await db
        .from("workout_blocks")
        .insert(blockRows);
    
    if (blockError) throw blockError;
    
    const exerciseRows = [];
    
    blocks.forEach(originalBlock => {
        const createdBlock = blockRows.find(
        block => block.block_order === originalBlock.block_order
        );
    
        originalBlock.exercises.forEach(exercise => {
        const exerciseRow = {
            workout_id: workoutId,
            block_id: createdBlock.id,
            name: exercise.name,
            description: exercise.description,
            sets: exercise.sets,
            reps: exercise.reps,
            tempo: exercise.tempo,
            rest_time: exercise.rest_time,
            input_type: exercise.input_type,
            video_url: exercise.video_url,
            coach_note: exercise.coach_note,
            exercise_order: exercise.exercise_order
        };

        if (exercise.exercise_template_id && exerciseLibraryAvailable) {
            exerciseRow.exercise_template_id = exercise.exercise_template_id;
        }

        exerciseRows.push(exerciseRow);
        });
    });
    
    const { error: exerciseError } = await db
        .from("workout_exercises")
        .insert(exerciseRows);
    
    if (exerciseError) throw exerciseError;

    const assignmentRows = buildAssignmentRows({
      workoutId,
      targetType,
      groupIds,
      memberProfileId,
      assignedDate
    });

    const { error: assignmentError } = await db
      .from("workout_assignments")
      .insert(assignmentRows);

    if (assignmentError) throw assignmentError;

    showWorkoutMessage(getAssignmentSuccessMessage({
      title,
      targetType,
      groupIds,
      memberProfileId,
      assignedDate
    }));

    resetWorkoutForm();
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not create workout.", true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitText || "Create & Assign Workout";
    }
  }
}

function resetWorkoutForm() {
    document.getElementById("workout-form").reset();
    document.getElementById("block-list").innerHTML = "";
    setTodayAsDefaultDate();
    updateAssignmentControls();
  
    // Start with common training blocks.
    addBlockCard();
}

// ----------------------------
// Recent workouts
// ----------------------------

async function loadRecentWorkouts() {
  const list = document.getElementById("recent-workouts-list");

  list.innerHTML = `<div class="empty-state">Loading workouts...</div>`;

  let { data, error } = await fetchRecentWorkoutRows(true);

  if (error && isMissingExerciseTemplateColumnError(error)) {
    ({ data, error } = await fetchRecentWorkoutRows(false));
  }

  if (error) {
    console.error(error);
    recentWorkoutRows = [];
    renderRecentWorkouts();
    list.innerHTML = `<div class="empty-state">Could not load workouts.</div>`;
    return;
  }

  recentWorkoutRows = data || [];
  renderRecentWorkouts();
}

function getRecentWorkoutFilters() {
  return {
    search: getInputValue("recent-workout-search").toLowerCase(),
    assignedDate: getInputValue("recent-workout-date-filter"),
    targetType: getInputValue("recent-workout-target-filter") || "all"
  };
}

function workoutMatchesRecentFilters(workout, filters) {
  const assignments = workout.workout_assignments || [];
  const targetLabels = assignments.map(getAssignmentTargetLabel);
  const searchableText = [
    workout.title,
    workout.focus,
    workout.description,
    ...targetLabels,
    ...(workout.workout_blocks || []).map(block => block.name),
    ...(workout.workout_blocks || []).flatMap(block =>
      (block.workout_exercises || []).map(exercise => exercise.name)
    )
  ].filter(Boolean).join(" ").toLowerCase();

  if (filters.search && !searchableText.includes(filters.search)) return false;

  if (filters.assignedDate && !assignments.some(row => row.assigned_date === filters.assignedDate)) {
    return false;
  }

  if (filters.targetType === "unassigned") {
    return assignments.length === 0;
  }

  if (filters.targetType !== "all" && !assignments.some(row => row.target_type === filters.targetType)) {
    return false;
  }

  return true;
}

function renderRecentWorkouts() {
  const list = document.getElementById("recent-workouts-list");
  const count = document.getElementById("recent-workouts-count");
  if (!list) return;

  if (!recentWorkoutRows.length) {
    if (count) count.textContent = "No workouts yet";
    list.innerHTML = `<div class="empty-state">No workouts created yet.</div>`;
    return;
  }

  const filters = getRecentWorkoutFilters();
  const filteredWorkouts = recentWorkoutRows.filter(workout =>
    workoutMatchesRecentFilters(workout, filters)
  );

  if (count) {
    count.textContent = `${filteredWorkouts.length} of ${recentWorkoutRows.length} shown`;
  }

  if (!filteredWorkouts.length) {
    list.innerHTML = `<div class="empty-state">No created workouts match those filters.</div>`;
    return;
  }

  list.innerHTML = filteredWorkouts.map(workout => {
    const assignments = workout.workout_assignments || [];
    const targetLabels = assignments.map(getAssignmentTargetLabel);
    const targetLabel = targetLabels.length
      ? [...new Set(targetLabels)].join(", ")
      : "Unassigned";
    const assignedDate = assignments[0]?.assigned_date || "No date";

    const blocks = [...(workout.workout_blocks || [])]
        .sort((a, b) => a.block_order - b.block_order);

    return `
      <article class="recent-workout-card">
        <div>
          <p class="eyebrow">${window.RipCityUI.text(workout.focus, "Workout")}</p>
          <h4>${window.RipCityUI.text(workout.title)}</h4>
          <p>${window.RipCityUI.text(workout.description, "No description added.")}</p>
        </div>

        <div class="workout-meta-row">
          <span>${workout.estimated_minutes || "—"} min</span>
          <span>${window.RipCityUI.text(targetLabel)}</span>
          <span>${window.RipCityUI.text(formatDisplayDate(assignedDate))}</span>
        </div>

        <div class="recent-workout-actions">
          <button class="outline-btn small-inline-btn" type="button" data-toggle-reassign-workout="${window.RipCityUI.attr(workout.id)}">
            Assign Again
          </button>
          <button class="outline-btn small-inline-btn" type="button" data-load-workout-template="${window.RipCityUI.attr(workout.id)}">
            Load in Builder
          </button>
          <button class="outline-btn small-inline-btn" type="button" data-toggle-workout-edit="${window.RipCityUI.attr(workout.id)}">
            Edit Details
          </button>
          <button class="outline-btn small-inline-btn danger-outline-btn" type="button" data-delete-workout="${window.RipCityUI.attr(workout.id)}">
            Delete Workout
          </button>
        </div>

        <div class="recent-assignment-list">
          <div class="recent-assignment-heading">
            <strong>Calendar Assignments</strong>
            <span>${assignments.length ? `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}` : "No assignments"}</span>
          </div>
          ${assignments.length ? assignments.map(assignment => `
            <div class="recent-assignment-row">
              <span>
                <strong>${window.RipCityUI.text(formatDisplayDate(assignment.assigned_date))}</strong>
                ${window.RipCityUI.text(getAssignmentTargetLabel(assignment))}
              </span>
              <button class="outline-btn small-inline-btn danger-outline-btn" type="button" data-remove-assignment="${window.RipCityUI.attr(assignment.id)}">
                Remove Assignment
              </button>
            </div>
          `).join("") : `<div class="empty-state compact-empty-state">This workout is saved but not assigned to a date.</div>`}
        </div>

        <form class="recent-workout-edit-form hidden" data-workout-edit-form="${window.RipCityUI.attr(workout.id)}">
          <label>
            Title
            <input type="text" value="${window.RipCityUI.attr(workout.title || "")}" data-edit-workout-title required />
          </label>
          <div class="form-row">
            <label>
              Focus
              <input type="text" value="${window.RipCityUI.attr(workout.focus || "")}" data-edit-workout-focus />
            </label>
            <label>
              Estimated Minutes
              <input type="number" value="${window.RipCityUI.attr(workout.estimated_minutes || "")}" data-edit-workout-minutes />
            </label>
          </div>
          <label>
            Description
            <textarea rows="2" data-edit-workout-description>${window.RipCityUI.text(workout.description || "")}</textarea>
          </label>
          <div class="recent-workout-actions">
            <button class="primary-btn small-inline-btn" type="submit">Save Details</button>
            <button class="outline-btn small-inline-btn" type="button" data-cancel-workout-edit="${window.RipCityUI.attr(workout.id)}">Cancel</button>
          </div>
        </form>

        <div class="recent-reassign-card hidden" data-reassign-workout-card="${window.RipCityUI.attr(workout.id)}">
          <div>
            <strong>Assign this workout again</strong>
            <span>Reuse the same blocks and exercises for another date, group, or athlete.</span>
          </div>

          <div class="recent-reassign-grid">
            <label>
              Assign To
              <select data-reuse-target-type="${window.RipCityUI.attr(workout.id)}">
                <option value="group">Groups</option>
                <option value="member">Individual Member</option>
                <option value="facility">Entire Facility</option>
              </select>
            </label>

            <label>
              Assigned Date
              <input type="date" value="${formatLocalDate(new Date())}" data-reuse-date="${window.RipCityUI.attr(workout.id)}" />
            </label>

            <label data-reuse-group-field="${window.RipCityUI.attr(workout.id)}">
              Groups
              <select multiple size="4" data-reuse-groups="${window.RipCityUI.attr(workout.id)}">
                ${renderAllGroupOptions()}
              </select>
            </label>

            <label class="hidden" data-reuse-member-field="${window.RipCityUI.attr(workout.id)}">
              Member
              <select data-reuse-member="${window.RipCityUI.attr(workout.id)}">
                <option value="">Select member...</option>
                ${renderAllMemberOptions()}
              </select>
            </label>
          </div>

          <button class="outline-btn full-btn" type="button" data-assign-existing-workout="${window.RipCityUI.attr(workout.id)}">
            Assign Existing Workout
          </button>
        </div>

        <details class="workout-preview-details">
          <summary>
            <span>Workout Preview</span>
            <small>${blocks.reduce((total, block) => total + (block.workout_exercises || []).length, 0)} exercises</small>
          </summary>

          <div class="workout-block-preview">
            ${blocks.map(block => {
                const exercises = [...(block.workout_exercises || [])]
                .sort((a, b) => a.exercise_order - b.exercise_order);

                return `
                <div class="workout-block-preview-item">
                    <strong>${window.RipCityUI.text(block.name)}</strong>
                    <ul class="workout-exercise-preview">
                    ${exercises.map(exercise => `
                        <li>
                        ${window.RipCityUI.text(exercise.name)}
                        ${exercise.sets || exercise.reps ? `<span>${window.RipCityUI.text(exercise.sets || "")} x ${window.RipCityUI.text(exercise.reps || "")}</span>` : ""}
                        </li>
                    `).join("")}
                    </ul>
                </div>
                `;
            }).join("")}
          </div>
        </details>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-reuse-target-type]").forEach(select => {
    select.addEventListener("change", () => updateRecentAssignmentControls(select.dataset.reuseTargetType));
    updateRecentAssignmentControls(select.dataset.reuseTargetType);
  });

  list.querySelectorAll("[data-assign-existing-workout]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.assignExistingWorkout);
      assignExistingWorkout(workout);
    });
  });

  list.querySelectorAll("[data-toggle-reassign-workout]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = document.querySelector(`[data-reassign-workout-card="${button.dataset.toggleReassignWorkout}"]`);
      const isHidden = panel?.classList.toggle("hidden");
      button.textContent = isHidden ? "Assign Again" : "Hide Assign";
    });
  });

  list.querySelectorAll("[data-remove-assignment]").forEach(button => {
    button.addEventListener("click", () => removeWorkoutAssignment(button.dataset.removeAssignment));
  });

  list.querySelectorAll("[data-delete-workout]").forEach(button => {
    button.addEventListener("click", () => deleteWorkout(button.dataset.deleteWorkout));
  });

  list.querySelectorAll("[data-load-workout-template]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.loadWorkoutTemplate);
      loadWorkoutIntoBuilder(workout);
    });
  });

  list.querySelectorAll("[data-toggle-workout-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-workout-edit-form="${button.dataset.toggleWorkoutEdit}"]`)
        ?.classList.toggle("hidden");
    });
  });

  list.querySelectorAll("[data-cancel-workout-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-workout-edit-form="${button.dataset.cancelWorkoutEdit}"]`)
        ?.classList.add("hidden");
    });
  });

  list.querySelectorAll("[data-workout-edit-form]").forEach(form => {
    form.addEventListener("submit", event => saveWorkoutDetails(event, form.dataset.workoutEditForm));
  });
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

async function deleteWorkout(workoutId) {
  const workout = recentWorkoutRows.find(row => row.id === workoutId);
  if (!workout) return;

  const assignmentCount = workout.workout_assignments?.length || 0;
  const confirmed = window.confirm(
    [
      "Delete this workout?",
      "",
      `Workout: ${workout.title}`,
      assignmentCount ? `Assignments: ${assignmentCount}` : "Assignments: none",
      "",
      "This removes the workout, exercises, assignments, and any saved member logs.",
      "This cannot be undone."
    ].join("\n")
  );

  if (!confirmed) return;

  showWorkoutMessage("Deleting workout...");

  try {
    const { error } = await db
      .from("workouts")
      .delete()
      .eq("id", workoutId)
      .eq("facility_id", workoutCoachAccess.membership.facility_id);

    if (error) throw error;

    showWorkoutMessage("Workout deleted.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not delete workout.", true);
  }
}

async function saveWorkoutDetails(event, workoutId) {
  event.preventDefault();

  const form = event.currentTarget;
  const title = form.querySelector("[data-edit-workout-title]").value.trim();
  const minutes = form.querySelector("[data-edit-workout-minutes]").value;

  if (!title) {
    showWorkoutMessage("Workout title is required.", true);
    return;
  }

  showWorkoutMessage("Saving workout details...");

  try {
    const { error } = await db
      .from("workouts")
      .update({
        title,
        focus: form.querySelector("[data-edit-workout-focus]").value.trim() || null,
        description: form.querySelector("[data-edit-workout-description]").value.trim() || null,
        estimated_minutes: minutes ? Number(minutes) : null
      })
      .eq("id", workoutId)
      .eq("facility_id", workoutCoachAccess.membership.facility_id);

    if (error) throw error;

    showWorkoutMessage("Workout details saved.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not save workout details.", true);
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
  const assignedDate = document.querySelector(`[data-reuse-date="${workoutId}"]`)?.value || "";
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
    assignedDate
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

async function logoutCoachWorkouts() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initCoachWorkoutsPage() {
  showWorkoutMessage("Checking access...");

  try {
    workoutCoachAccess = await requireCoachOrAdmin();

    if (!workoutCoachAccess) return;

    availableGroups = await loadGroups(workoutCoachAccess.membership.facility_id);
    availableMembers = await loadAssignableMembers(workoutCoachAccess.membership.facility_id);
    availableGroupMemberships = await loadAssignableGroupMemberships(
      availableMembers.map(member => member.memberProfileId)
    );
    refreshAssignmentOptions();
    await refreshExerciseLibrary();

    setTodayAsDefaultDate();
    addBlockCard();
    await loadRecentWorkouts();

    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load workout page.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachWorkoutsPage();

  document.getElementById("add-block-btn").addEventListener("click", addBlockCard);
  document.getElementById("exercise-library-form").addEventListener("submit", saveExerciseTemplate);
  document.getElementById("exercise-library-search")?.addEventListener("input", renderExerciseLibraryList);
  document.getElementById("exercise-library-category-filter")?.addEventListener("change", renderExerciseLibraryList);
  document.getElementById("exercise-library-input-filter")?.addEventListener("change", renderExerciseLibraryList);
  document.getElementById("recent-workout-search")?.addEventListener("input", renderRecentWorkouts);
  document.getElementById("recent-workout-date-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("recent-workout-target-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("workout-target-type").addEventListener("change", updateAssignmentControls);
  document.getElementById("workout-form").addEventListener("submit", createWorkoutWithAssignment);
  document.getElementById("refresh-workouts-btn").addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-workouts-logout-btn").addEventListener("click", logoutCoachWorkouts);
});
