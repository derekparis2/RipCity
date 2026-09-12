// =====================================================
// COACH WORKOUT HISTORY
// =====================================================
// Owns loading, filtering, rendering, editing, and deleting saved workouts.

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

