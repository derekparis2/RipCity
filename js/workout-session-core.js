// =====================================================
// WORKOUT SESSION CORE DATA
// =====================================================
// Shared state, small formatting helpers, auth checks, and Supabase loaders
// for workout-session.html. Rendering and save actions live in separate files.

let workoutSessionAccess = null;
let workoutMemberProfile = null;
let workoutAssignment = null;
let existingSetLogs = [];

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

  if (assignment.workout.facility_id !== workoutSessionAccess.membership.facility_id) {
    return false;
  }

  if (assignment.target_type === "group") {
    const groupIds = await getMemberGroupIds(workoutMemberProfile.id);
    return groupIds.includes(assignment.target_group_id);
  }

  if (assignment.target_type === "member") {
    return assignment.target_member_profile_id === workoutMemberProfile.id;
  }

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
