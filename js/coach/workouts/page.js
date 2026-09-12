// =====================================================
// COACH WORKOUTS PAGE CONTROLLER
// =====================================================
// Coordinates authentication, module initialization, and the complete workout
// save workflow.

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
