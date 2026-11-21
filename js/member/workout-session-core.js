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
let workoutSessionView = "overview";
let workoutSessionMessageTimer = null;

function showWorkoutSessionMessage(message, isError = false) {
  const element = document.getElementById("workout-session-message");
  if (!element) return;

  window.clearTimeout(workoutSessionMessageTimer);
  element.classList.remove("session-message-toast");
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function showWorkoutSessionToast(message) {
  const element = document.getElementById("workout-session-message");
  if (!element) return;

  window.clearTimeout(workoutSessionMessageTimer);
  element.textContent = message;
  element.classList.remove("error-message");
  element.classList.add("session-message-toast");
  workoutSessionMessageTimer = window.setTimeout(() => {
    element.textContent = "";
    element.classList.remove("session-message-toast");
  }, 2200);
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
    band_color: "Band + Reps",
    time: "Time",
    distance: "Distance",
    custom: "Custom"
  };

  return labels[inputType] || inputType;
}

function getExerciseTargetText(exercise) {
  const sets = exercise.sets || 1;
  const reps = exercise.reps || "complete";
  const target = exercise.is_unilateral ? `${reps} each side` : reps;

  return `${sets} x ${target}`;
}

function getSetTargetText(exercise, setNumber) {
  const targetValue = getSetTargetValue(exercise, setNumber);
  const totalSets = Number(exercise.sets || 1);

  if (targetValue) {
    return `Set ${setNumber} of ${totalSets}: ${targetValue.value}${exercise.is_unilateral ? " each side" : ""}`;
  }

  return `Set ${setNumber} of ${totalSets}: complete`;
}

function getSetTargetValue(exercise, setNumber) {
  const reps = String(exercise.reps || "").trim();

  if (!reps) {
    return null;
  }

  const setTargets = reps
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (setTargets.length > 1) {
    return {
      value: setTargets[setNumber - 1] || setTargets[setTargets.length - 1],
      isPerSet: true
    };
  }

  return {
    value: reps,
    isPerSet: false
  };
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

  return previousLogs[0]?.weight ?? "";
}

function findPreviousRepsForExercise(exerciseId, setNumber) {
  const previousLogs = existingSetLogs
    .filter(log =>
      log.exercise_id === exerciseId &&
      Number(log.set_number) < Number(setNumber) &&
      log.reps_completed !== null
    )
    .sort((a, b) => Number(b.set_number) - Number(a.set_number));

  return previousLogs[0]?.reps_completed ?? "";
}

function getExerciseBlockLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index] || `${index + 1}`;
}

function formatWorkoutAssignmentDate(dateKey) {
  if (!dateKey) return "—";

  const [year, month, day] = String(dateKey).split("-").map(Number);
  if (!year || !month || !day) return dateKey;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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
  return window.RipCityAccess.requireMemberAccess();
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
      assigned_by,
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
        created_by,
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
            is_unilateral,
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

// Drafts stay in this page only; navigating between sets never throws away edits.
const workoutSetDrafts = new Map();
let workoutSessionSaving = false;
let workoutSessionLeaving = false;
const workoutDraftFields = [".set-weight-input", ".set-reps-input", ".set-band-input", ".set-time-input", ".set-distance-input", ".set-difficulty-input", ".set-note-input", ".set-completed-input"];
function getSetDraftKey(row) { return `${row.dataset.exerciseId}:${row.dataset.setNumber}`; }
function captureWorkoutSetDraft(row) {
  if (!row || row.dataset.dirty !== "true") return;
  workoutSetDrafts.set(getSetDraftKey(row), Object.fromEntries(workoutDraftFields.map(selector => {
    const input = row.querySelector(selector);
    return [selector, input ? { value: input.value, checked: input.checked, invalid: input.validity ? !input.validity.valid : false } : null];
  })));
}
function captureCurrentWorkoutDrafts() {
  document.querySelectorAll(".set-log-row").forEach(captureWorkoutSetDraft);
}
function restoreWorkoutSetDrafts() {
  document.querySelectorAll(".set-log-row").forEach(row => {
    const draft = workoutSetDrafts.get(getSetDraftKey(row));
    if (draft) {
      for (const [selector, value] of Object.entries(draft)) {
        const input = row.querySelector(selector);
        if (!input || !value) continue;
        input.value = value.value;
        if (input.type === "checkbox") input.checked = value.checked;
      }
      row.dataset.dirty = "true";
      const status = row.querySelector(".set-log-title em");
      if (status) status.textContent = "Unsaved changes";
    }
    row.addEventListener("input", () => {
      row.dataset.dirty = "true";
      captureWorkoutSetDraft(row);
      const status = row.querySelector(".set-log-title em");
      if (status) status.textContent = "Unsaved changes";
      syncWorkoutNextButton(row);
    });
    row.addEventListener("change", () => {
      row.dataset.dirty = "true";
      captureWorkoutSetDraft(row);
      syncWorkoutNextButton(row);
    });
    syncWorkoutNextButton(row);
  });
}
function clearWorkoutSetDraft(row) {
  workoutSetDrafts.delete(getSetDraftKey(row));
  row.dataset.dirty = "false";
}
function setWorkoutSaveBusy(busy) {
  workoutSessionSaving = busy;
  const container = document.getElementById("workout-session-container");
  container?.setAttribute("aria-busy", String(busy));
  document.querySelectorAll("#workout-session-container button, #workout-session-container input, #workout-session-container select, #workout-session-container textarea, #refresh-session-btn, #finish-workout-btn").forEach(control => {
    if (busy) { control.dataset.wasDisabled = String(control.disabled); control.disabled = true; }
    else if (control.dataset.wasDisabled !== undefined) {
      control.disabled = control.dataset.wasDisabled === "true";
      delete control.dataset.wasDisabled;
    }
  });
}
function confirmDiscardWorkoutDrafts() {
  captureCurrentWorkoutDrafts();
  return !workoutSetDrafts.size || window.confirm("Discard unsaved workout changes? Saved sets will stay saved.");
}

function getWorkoutDemoUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}
