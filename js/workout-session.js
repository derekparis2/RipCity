// =====================================================
// WORKOUT SESSION ACTIONS
// =====================================================
// Handles saving member set logs and starting the page. This file expects
// workout-session-core.js and workout-session-render.js to load first.

function buildLogRowFromSetRow(row) {
  const difficultyValue = getInputValue(".set-difficulty-input", row);

  const logRow = {
    workout_assignment_id: workoutAssignment.id,
    member_profile_id: workoutMemberProfile.id,
    exercise_id: row.dataset.exerciseId,
    set_number: Number(row.dataset.setNumber),
    completed: isChecked(".set-completed-input", row),
    weight: hasValue(".set-weight-input", row) ? Number(getInputValue(".set-weight-input", row)) : null,
    reps_completed: hasValue(".set-reps-input", row) ? Number(getInputValue(".set-reps-input", row)) : null,
    band_color: getInputValue(".set-band-input", row) || null,
    time_value: getInputValue(".set-time-input", row) || null,
    distance_value: getInputValue(".set-distance-input", row) || null,
    difficulty_rating: difficultyValue ? Number(difficultyValue) : null,
    athlete_note: getInputValue(".set-note-input", row) || null,
    logged_at: new Date().toISOString()
  };

  const hasActualData =
    logRow.weight !== null ||
    logRow.reps_completed !== null ||
    logRow.band_color !== null ||
    logRow.time_value !== null ||
    logRow.distance_value !== null ||
    logRow.athlete_note !== null;

  // Any entered result should count as completed even if the checkbox was missed.
  if (hasActualData) {
    logRow.completed = true;
  }

  return logRow;
}

async function saveSetLog(exerciseId, setNumber) {
  const row = document.querySelector(
    `.set-log-row[data-exercise-id="${exerciseId}"][data-set-number="${setNumber}"]`
  );

  if (!row) {
    showWorkoutSessionMessage("Could not find set row.", true);
    return;
  }

  showWorkoutSessionMessage("Saving set...");

  try {
    const logRow = buildLogRowFromSetRow(row);

    const { error } = await db
      .from("exercise_set_logs")
      .upsert(logRow, {
        onConflict: "workout_assignment_id,member_profile_id,exercise_id,set_number"
      });

    if (error) throw error;

    existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);
    renderWorkoutSession();

    showWorkoutSessionMessage("Set saved.");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not save set.", true);
  }
}

async function saveAllSetLogs() {
  const setRows = Array.from(document.querySelectorAll(".set-log-row"));

  if (!setRows.length) {
    showWorkoutSessionMessage("No sets found to save.", true);
    return;
  }

  showWorkoutSessionMessage("Saving all sets...");

  try {
    const logRows = setRows.map(row => buildLogRowFromSetRow(row));

    const { error } = await db
      .from("exercise_set_logs")
      .upsert(logRows, {
        onConflict: "workout_assignment_id,member_profile_id,exercise_id,set_number"
      });

    if (error) throw error;

    existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);
    renderWorkoutSession();

    showWorkoutSessionMessage("All sets saved.");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not save all sets.", true);
  }
}

async function refreshWorkoutSession() {
  showWorkoutSessionMessage("Loading workout...");

  try {
    const assignmentId = getAssignmentIdFromUrl();

    if (!assignmentId) {
      showWorkoutSessionMessage("Missing workout assignment ID.", true);
      return;
    }

    workoutAssignment = await loadWorkoutAssignment(assignmentId);

    const canAccess = await userCanAccessAssignment(workoutAssignment);

    if (!canAccess) {
      showWorkoutSessionMessage("You do not have access to this workout.", true);
      return;
    }

    existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);

    updateWorkoutHeader();
    renderWorkoutSession();

    showWorkoutSessionMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not load workout.", true);
  }
}

async function logoutWorkoutSession() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initWorkoutSessionPage() {
  showWorkoutSessionMessage("Checking access...");

  try {
    workoutSessionAccess = await requireApprovedWorkoutMember();

    if (!workoutSessionAccess) return;

    workoutMemberProfile = await getWorkoutMemberProfile(workoutSessionAccess.membership.id);

    await refreshWorkoutSession();
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not open workout.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initWorkoutSessionPage();

  document.getElementById("refresh-session-btn")?.addEventListener("click", refreshWorkoutSession);
  document.getElementById("save-all-sets-btn")?.addEventListener("click", saveAllSetLogs);
  document.getElementById("mobile-save-all-sets-btn")?.addEventListener("click", saveAllSetLogs);
  document.getElementById("workout-session-logout-btn")?.addEventListener("click", logoutWorkoutSession);
});
