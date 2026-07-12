// =====================================================
// WORKOUT SESSION PAGE
// =====================================================
// Members open an assigned workout and log actual results.
// Coach targets come from workout_exercises.
// Actual member results save to exercise_set_logs.
//
// Display style:
// Blocks are shown by rounds so supersets/circuits feel natural.
// Example:
// A Block
// Round 1: A Trap Bar Deadlift set 1, B Box Jump set 1
// Round 2: A Trap Bar Deadlift set 2, B Box Jump set 2

let workoutSessionAccess = null;
let workoutMemberProfile = null;
let workoutAssignment = null;
let existingSetLogs = [];

// ----------------------------
// Helpers
// ----------------------------

function showWorkoutSessionMessage(message, isError = false) {
  const element = document.getElementById("workout-session-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function getAssignmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("assignment");
}

function getInputValue(selector, parent = document) {
  const element = parent.querySelector(selector);
  if (!element) return "";
  return element.value.trim();
}

function isChecked(selector, parent = document) {
  const element = parent.querySelector(selector);
  if (!element) return false;
  return element.checked;
}

function formatInputType(inputType) {
  const labels = {
    completion: "Completion",
    weight_reps: "Weight + Reps",
    band_color: "Band Color",
    time: "Time",
    distance: "Distance",
    custom: "Custom"
  };

  return labels[inputType] || inputType;
}

function getExerciseTargetText(exercise) {
  const sets = exercise.sets || 1;
  const reps = exercise.reps || "complete";

  return `${sets} x ${reps}`;
}

function findExistingLog(exerciseId, setNumber) {
  return existingSetLogs.find(log =>
    log.exercise_id === exerciseId &&
    Number(log.set_number) === Number(setNumber)
  );
}

function getExerciseBlockLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index] || `${index + 1}`;
}

// ----------------------------
// Auth / approved member access
// ----------------------------

async function getWorkoutSessionAuthSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  return data.session;
}

async function getWorkoutSessionProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      global_role,
      facility_members:facility_members!facility_members_profile_id_fkey (
        id,
        role,
        status,
        facility_id
      )
    `)
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

async function getWorkoutMemberProfile(facilityMemberId) {
  const { data, error } = await db
    .from("member_profiles")
    .select("*")
    .eq("facility_member_id", facilityMemberId)
    .single();

  if (error) throw error;

  return data;
}

async function requireApprovedWorkoutMember() {
  const session = await getWorkoutSessionAuthSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const profile = await getWorkoutSessionProfile(session.user.id);

  const membership =
    profile.facility_members?.[0] ||
    profile["facility_members!facility_members_profile_id_fkey"]?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  return {
    session,
    profile,
    membership
  };
}

// ----------------------------
// Load assignment / permission
// ----------------------------

async function getMemberGroupIds(memberProfileId) {
  const { data, error } = await db
    .from("group_members")
    .select("group_id")
    .eq("member_profile_id", memberProfileId);

  if (error) throw error;

  return (data || []).map(row => row.group_id);
}

async function loadWorkoutAssignment(assignmentId) {
  const { data, error } = await db
    .from("workout_assignments")
    .select(`
      id,
      assigned_date,
      target_type,
      target_group_id,
      target_member_profile_id,
      target_facility_id,
      workout:workouts (
        id,
        facility_id,
        title,
        focus,
        description,
        estimated_minutes,
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
            percentage,
            rest_time,
            video_url,
            coach_note,
            input_type,
            exercise_order
          )
        )
      )
    `)
    .eq("id", assignmentId)
    .single();

  if (error) throw error;

  return data;
}

async function userCanAccessAssignment(assignment) {
  if (!assignment || !assignment.workout) return false;

  // Same facility check.
  if (assignment.workout.facility_id !== workoutSessionAccess.membership.facility_id) {
    return false;
  }

  // Group assignment check.
  if (assignment.target_type === "group") {
    const groupIds = await getMemberGroupIds(workoutMemberProfile.id);
    return groupIds.includes(assignment.target_group_id);
  }

  // Individual member assignment check.
  if (assignment.target_type === "member") {
    return assignment.target_member_profile_id === workoutMemberProfile.id;
  }

  // Facility-wide assignment check.
  if (assignment.target_type === "facility") {
    return assignment.target_facility_id === workoutSessionAccess.membership.facility_id;
  }

  return false;
}

async function loadExistingSetLogs(assignmentId) {
  const { data, error } = await db
    .from("exercise_set_logs")
    .select("*")
    .eq("workout_assignment_id", assignmentId)
    .eq("member_profile_id", workoutMemberProfile.id);

  if (error) throw error;

  return data || [];
}

// ----------------------------
// Render
// ----------------------------

function updateWorkoutHeader() {
  const workout = workoutAssignment.workout;

  document.getElementById("session-workout-title").textContent = workout.title;
  document.getElementById("session-workout-description").textContent =
    workout.description || "Log your actual work for each set.";

  document.getElementById("session-focus").textContent = workout.focus || "Workout";
  document.getElementById("session-minutes").textContent = workout.estimated_minutes || "—";
  document.getElementById("session-date").textContent = workoutAssignment.assigned_date;
}

function getAllExercises() {
  const workout = workoutAssignment.workout;

  const blocks = [...(workout.workout_blocks || [])]
    .sort((a, b) => a.block_order - b.block_order);

  const exercises = [];

  blocks.forEach(block => {
    const blockExercises = [...(block.workout_exercises || [])]
      .sort((a, b) => a.exercise_order - b.exercise_order);

    blockExercises.forEach(exercise => {
      exercises.push(exercise);
    });
  });

  return exercises;
}

function getTotalSetCount() {
  const exercises = getAllExercises();

  return exercises.reduce((total, exercise) => {
    return total + Number(exercise.sets || 1);
  }, 0);
}

function getCompletedSetCount() {
  return existingSetLogs.filter(log => log.completed).length;
}

function updateSetStats() {
  document.getElementById("session-sets-complete").textContent = getCompletedSetCount();
  document.getElementById("session-sets-total").textContent = getTotalSetCount();
}

function renderWorkoutSession() {
  const container = document.getElementById("workout-session-container");
  const workout = workoutAssignment.workout;

  const blocks = [...(workout.workout_blocks || [])]
    .sort((a, b) => a.block_order - b.block_order);

  if (!blocks.length) {
    container.innerHTML = `<div class="empty-state">This workout has no blocks yet.</div>`;
    return;
  }

  container.innerHTML = blocks.map(block => {
    const exercises = [...(block.workout_exercises || [])]
      .sort((a, b) => a.exercise_order - b.exercise_order);

    return `
      <article class="session-block-card">
        <div class="session-block-heading">
          <p class="eyebrow">BLOCK</p>
          <h3>${block.name}</h3>
        </div>

        <div class="session-round-list">
          ${renderBlockRounds(exercises)}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".save-set-btn").forEach(button => {
    button.addEventListener("click", () => {
      saveSetLog(button.dataset.exerciseId, Number(button.dataset.setNumber));
    });
  });

  updateSetStats();
}

function renderBlockRounds(exercises) {
  if (!exercises.length) {
    return `<div class="empty-state">No exercises in this block.</div>`;
  }

  const maxSets = Math.max(
    ...exercises.map(exercise => Number(exercise.sets || 1))
  );

  let roundHtml = "";

  for (let roundNumber = 1; roundNumber <= maxSets; roundNumber++) {
    const exercisesForRound = exercises.filter(exercise => {
      const totalSets = Number(exercise.sets || 1);
      return roundNumber <= totalSets;
    });

    roundHtml += `
      <article class="session-round-card">
        <div class="session-round-heading">
          <p class="eyebrow">ROUND ${roundNumber}</p>
          <h4>Set ${roundNumber}</h4>
        </div>

        <div class="session-round-exercises">
          ${exercisesForRound.map((exercise, exerciseIndex) => {
            const label = getExerciseBlockLabel(exerciseIndex);

            return `
              <div class="round-exercise-item">
                <div class="round-exercise-label">${label}</div>
                ${renderExerciseSetLogger(exercise, roundNumber)}
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }

  return roundHtml;
}

// Kept for safety in case another part of the file references it later.
function renderExerciseLogger(exercise) {
  return renderExerciseSetLogger(exercise, 1);
}

function renderExerciseSetLogger(exercise, setNumber) {
  return `
    <article class="session-exercise-card">
      <div class="session-exercise-header">
        <div>
          <h4>${exercise.name}</h4>
          <p>${exercise.description || "No description added."}</p>
        </div>

        <div class="session-exercise-tags">
          <span>Target: ${getExerciseTargetText(exercise)}</span>
          ${exercise.tempo ? `<span>Tempo: ${exercise.tempo}</span>` : ""}
          ${exercise.rest_time ? `<span>Rest: ${exercise.rest_time}</span>` : ""}
          ${exercise.percentage ? `<span>${exercise.percentage}</span>` : ""}
          <span>${formatInputType(exercise.input_type)}</span>
        </div>
      </div>

      ${exercise.coach_note ? `
        <div class="session-coach-note">
          <strong>Coach Note</strong>
          <p>${exercise.coach_note}</p>
        </div>
      ` : ""}

      <div class="set-log-list">
        ${renderSetLogger(exercise, setNumber)}
      </div>
    </article>
  `;
}

function renderSetLogger(exercise, setNumber) {
  const existing = findExistingLog(exercise.id, setNumber);
  const completed = existing?.completed || false;

  return `
    <div class="set-log-row ${completed ? "set-complete" : ""}" data-set-row="${exercise.id}-${setNumber}">
      <div class="set-log-title">
        <strong>Set ${setNumber}</strong>
        <span>${completed ? "Saved" : "Not saved"}</span>
      </div>

      ${renderInputsForExerciseType(exercise, existing)}

      <label class="set-complete-check">
        <input
          type="checkbox"
          class="set-completed-input"
          ${completed ? "checked" : ""}
        />
        Completed
      </label>

      <label>
        Difficulty
        <select class="set-difficulty-input">
          <option value="">Optional</option>
          ${[1,2,3,4,5,6,7,8,9,10].map(num => `
            <option value="${num}" ${Number(existing?.difficulty_rating) === num ? "selected" : ""}>
              ${num}/10
            </option>
          `).join("")}
        </select>
      </label>

      <label>
        Note
        <input
          type="text"
          class="set-note-input"
          value="${existing?.athlete_note || ""}"
          placeholder="Optional note"
        />
      </label>

      <button
        class="primary-btn save-set-btn"
        type="button"
        data-exercise-id="${exercise.id}"
        data-set-number="${setNumber}"
      >
        Save Set
      </button>
    </div>
  `;
}

function renderInputsForExerciseType(exercise, existing) {
  if (exercise.input_type === "weight_reps") {
    return `
      <div class="set-input-grid">
        <label>
          Actual Weight
          <input
            type="number"
            class="set-weight-input"
            value="${existing?.weight ?? ""}"
            placeholder="ex: 185"
          />
        </label>

        <label>
          Actual Reps
          <input
            type="number"
            class="set-reps-input"
            value="${existing?.reps_completed ?? ""}"
            placeholder="${exercise.reps || "reps"}"
          />
        </label>
      </div>
    `;
  }

  if (exercise.input_type === "band_color") {
    return `
      <label>
        Band Color
        <input
          type="text"
          class="set-band-input"
          value="${existing?.band_color || ""}"
          placeholder="Red, black, green..."
        />
      </label>
    `;
  }

  if (exercise.input_type === "time") {
    return `
      <label>
        Actual Time
        <input
          type="text"
          class="set-time-input"
          value="${existing?.time_value || ""}"
          placeholder="${exercise.reps || "ex: 10.4 sec"}"
        />
      </label>
    `;
  }

  if (exercise.input_type === "distance") {
    return `
      <label>
        Actual Distance
        <input
          type="text"
          class="set-distance-input"
          value="${existing?.distance_value || ""}"
          placeholder="${exercise.reps || "ex: 20 yards"}"
        />
      </label>
    `;
  }

  if (exercise.input_type === "custom") {
    return `
      <label>
        Custom Result
        <input
          type="text"
          class="set-note-input"
          value="${existing?.athlete_note || ""}"
          placeholder="Enter result"
        />
      </label>
    `;
  }

  return `
    <p class="completion-only-text">
      Mark this set as completed when finished.
    </p>
  `;
}

// ----------------------------
// Save set logs
// ----------------------------

async function saveSetLog(exerciseId, setNumber) {
  const row = document.querySelector(`[data-set-row="${exerciseId}-${setNumber}"]`);

  if (!row) {
    showWorkoutSessionMessage("Could not find set row.", true);
    return;
  }

  showWorkoutSessionMessage("Saving set...");

  try {
    const difficultyValue = getInputValue(".set-difficulty-input", row);

    const logRow = {
      workout_assignment_id: workoutAssignment.id,
      member_profile_id: workoutMemberProfile.id,
      exercise_id: exerciseId,
      set_number: setNumber,
      completed: isChecked(".set-completed-input", row),
      weight: getInputValue(".set-weight-input", row) ? Number(getInputValue(".set-weight-input", row)) : null,
      reps_completed: getInputValue(".set-reps-input", row) ? Number(getInputValue(".set-reps-input", row)) : null,
      band_color: getInputValue(".set-band-input", row) || null,
      time_value: getInputValue(".set-time-input", row) || null,
      distance_value: getInputValue(".set-distance-input", row) || null,
      difficulty_rating: difficultyValue ? Number(difficultyValue) : null,
      athlete_note: getInputValue(".set-note-input", row) || null,
      logged_at: new Date().toISOString()
    };

    // If they entered any actual data but forgot to check completed,
    // we mark it completed automatically.
    const hasActualData =
      logRow.weight !== null ||
      logRow.reps_completed !== null ||
      logRow.band_color !== null ||
      logRow.time_value !== null ||
      logRow.distance_value !== null ||
      logRow.athlete_note !== null;

    if (hasActualData) {
      logRow.completed = true;
    }

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

// ----------------------------
// Init
// ----------------------------

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

  document.getElementById("refresh-session-btn").addEventListener("click", refreshWorkoutSession);
  document.getElementById("workout-session-logout-btn").addEventListener("click", logoutWorkoutSession);
});