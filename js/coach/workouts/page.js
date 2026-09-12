// =====================================================
// COACH WORKOUTS PAGE CONTROLLER
// =====================================================
// Coordinates authentication, module initialization, and the complete workout
// save workflow.

// ----------------------------
// Save workout
// ----------------------------

function clearWorkoutValidationErrors() {
  document.querySelectorAll("#workout-form [aria-invalid='true']").forEach(element => {
    element.removeAttribute("aria-invalid");
  });
}

function showWorkoutValidationError(message, element) {
  showWorkoutMessage(message, true);
  element?.setAttribute("aria-invalid", "true");
  element?.focus();
}

function getWorkoutValidationError({ shouldAssign, title, minutes, targetType, groupIds, memberProfileId, assignedDate }) {
  if (!title) {
    return {
      message: "Add a workout title before saving.",
      element: document.getElementById("workout-title")
    };
  }

  if (minutes && Number(minutes) <= 0) {
    return {
      message: "Estimated minutes must be greater than zero.",
      element: document.getElementById("workout-minutes")
    };
  }

  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));
  if (!blockCards.length) {
    return {
      message: "Add at least one workout block before saving.",
      element: document.getElementById("add-block-btn")
    };
  }

  for (const blockCard of blockCards) {
    const blockName = blockCard.querySelector(".block-name");
    if (!blockName?.value.trim()) {
      return { message: "Every workout block needs a name.", element: blockName };
    }

    const exerciseCards = Array.from(blockCard.querySelectorAll("[data-exercise-card]"));
    const namedExercises = exerciseCards.filter(card => card.querySelector(".exercise-name")?.value.trim());
    if (!namedExercises.length) {
      return {
        message: `Add at least one exercise to ${blockName.value.trim()}.`,
        element: exerciseCards[0]?.querySelector(".exercise-name") || blockName
      };
    }

    const emptyExercise = exerciseCards.find(card => !card.querySelector(".exercise-name")?.value.trim());
    if (emptyExercise) {
      return {
        message: `Name or remove the empty exercise in ${blockName.value.trim()}.`,
        element: emptyExercise.querySelector(".exercise-name")
      };
    }
  }

  if (!shouldAssign) return null;

  if (!assignedDate) {
    return {
      message: "Choose an assigned date before creating the assignment.",
      element: document.getElementById("workout-date")
    };
  }

  if (targetType === "group" && !groupIds.length) {
    return {
      message: "Choose at least one group for this assignment.",
      element: document.querySelector("#workout-group input")
    };
  }

  if (targetType === "member" && !memberProfileId) {
    return {
      message: "Choose a member for this assignment.",
      element: document.getElementById("workout-member")
    };
  }

  return null;
}

async function saveWorkout(event) {
  event.preventDefault();
  updateAssignmentControls();

  const submitButton = event.submitter;
  const shouldAssign = submitButton?.value !== "draft";
  const submitButtons = Array.from(document.querySelectorAll("#workout-form button[type='submit']"));
  const originalSubmitLabels = new Map(submitButtons.map(button => [button, button.textContent]));

  try {
    clearWorkoutValidationErrors();

    const title = getInputValue("workout-title");
    const focus = getInputValue("workout-focus");
    const description = getInputValue("workout-description");
    const minutes = getInputValue("workout-minutes");
    const targetType = getInputValue("workout-target-type") || "group";
    const groupIds = getSelectedValues("workout-group");
    const memberProfileId = getInputValue("workout-member");
    const assignedDate = getInputValue("workout-date");

    const validationError = getWorkoutValidationError({
      shouldAssign,
      title,
      minutes,
      targetType,
      groupIds,
      memberProfileId,
      assignedDate
    });

    if (validationError) {
      showWorkoutValidationError(validationError.message, validationError.element);
      return;
    }

    const blocks = getBlockFormData();

    if (!blocks.length) {
      showWorkoutMessage("Add at least one block with at least one exercise.", true);
      return;
    }

    if (shouldAssign && !confirmWorkoutCreate({ title, targetType, groupIds, memberProfileId, assignedDate })) {
      showWorkoutMessage("Workout creation cancelled.");
      return;
    }

    workoutSaveInProgress = true;
    submitButtons.forEach(button => {
      button.disabled = true;
    });

    if (submitButton) {
      submitButton.textContent = shouldAssign ? "Creating & Assigning..." : "Saving Draft...";
    }

    showWorkoutMessage(shouldAssign ? "Creating and assigning workout..." : "Saving workout draft...");

    // Only sync custom exercises after any assignment confirmation so canceling
    // the workflow never writes an exercise template by itself.
    await ensureWorkoutExercisesAreInLibrary(blocks);

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

    if (shouldAssign) {
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
    } else {
      showWorkoutMessage(`Workout "${title}" saved as a draft.`);
    }

    resetWorkoutForm();
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not create workout.", true);
  } finally {
    workoutSaveInProgress = false;
    submitButtons.forEach(button => {
      button.disabled = false;
      button.textContent = originalSubmitLabels.get(button);
    });
  }
}

function resetWorkoutForm() {
  document.getElementById("workout-form").reset();
  document.getElementById("block-list").innerHTML = "";
  clearWorkoutValidationErrors();
  setTodayAsDefaultDate();
  updateAssignmentControls();

  // Start with a common training block.
  addBlockCard();
  setWorkoutDetailsCollapsed(false);
  markWorkoutFormClean();
}

// ----------------------------
// Recent workouts
// ----------------------------

async function logoutCoachWorkouts() {
  if (workoutFormDirty && !window.confirm("Discard the unsaved workout and log out?")) {
    return;
  }

  workoutFormDirty = false;
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

    markWorkoutFormClean();
    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load workout page.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeWorkoutBuilderTracking();
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
  document.getElementById("workout-form").addEventListener("submit", saveWorkout);
  document.getElementById("refresh-workouts-btn").addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-workouts-logout-btn").addEventListener("click", logoutCoachWorkouts);
});
