// =====================================================
// WORKOUT SESSION CORE DATA
// =====================================================
// Shared state, small formatting helpers, auth checks, and Supabase loaders
// for workout-session.html. Rendering and save actions live in separate files.

let workoutSessionAccess = null;
let workoutMemberProfile = null;
let workoutAssignment = null;
let existingSetLogs = [];
let currentSessionStepIndex = 0;

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

function hasValue(selector, parent = document) {
  return getInputValue(selector, parent) !== "";
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

// Reuses the previous saved weight/reps for the same exercise so members
// do not need to retype the same value every round.
function findPreviousWeightForExercise(exerciseId, setNumber) {
  const previousLogs = existingSetLogs
    .filter(log =>
      log.exercise_id === exerciseId &&
      Number(log.set_number) < Number(setNumber) &&
      log.weight !== null
    )
    .sort((a, b) => Number(b.set_number) - Number(a.set_number));

  return previousLogs[0]?.weight || "";
}

function findPreviousRepsForExercise(exerciseId, setNumber) {
  const previousLogs = existingSetLogs
    .filter(log =>
      log.exercise_id === exerciseId &&
      Number(log.set_number) < Number(setNumber) &&
      log.reps_completed !== null
    )
    .sort((a, b) => Number(b.set_number) - Number(a.set_number));

  return previousLogs[0]?.reps_completed || "";
}

function getExerciseBlockLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index] || `${index + 1}`;
}

async function getWorkoutSessionAuthSession() {
  return window.RipCityAccess.getSession();
}

async function getWorkoutSessionProfile(userId) {
  return window.RipCityAccess.getProfileWithMemberships(userId);
}

async function getWorkoutMemberProfile(facilityMemberId) {
  return window.RipCityAccess.getMemberProfileForMembership(facilityMemberId);
}

async function requireApprovedWorkoutMember() {
  return window.RipCityAccess.requireApprovedAccess();
}

async function getMemberGroupIds(memberProfileId) {
  return window.RipCityWorkoutData.loadMemberGroupIds(memberProfileId);
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

  const groupIds = await getMemberGroupIds(workoutMemberProfile.id);

  return window.RipCityWorkoutData.isAssignmentVisibleToMember(assignment, {
    facilityId: workoutSessionAccess.membership.facility_id,
    memberProfileId: workoutMemberProfile.id,
    groupIds
  });
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
