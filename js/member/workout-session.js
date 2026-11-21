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
    (row.dataset.inputType === "custom" && logRow.athlete_note !== null);

  // Any entered result should count as completed even if the checkbox was missed.
  if (hasActualData) {
    logRow.completed = true;
  }

  return logRow;
}

function hasRequiredWorkoutResults(row) {
  const required = { weight_reps: [".set-weight-input", ".set-reps-input"], band_color: [".set-reps-input"],
    time: [".set-time-input"], distance: [".set-distance-input"], custom: [".set-note-input"] }[row.dataset.inputType];
  return required ? required.every(selector => hasValue(selector, row)) : isChecked(".set-completed-input", row);
}

function syncWorkoutNextButton(row) {
  const button = row.querySelector(".session-next-step-btn");
  if (button) button.textContent = "Next";
}

function createWorkoutDraftRow(step, draft) {
  const inputs = Object.fromEntries(Object.entries(draft).filter(([, value]) => value).map(([selector, value]) => [selector, {
    ...value, checkValidity: () => !value.invalid, reportValidity() {}, focus() {}
  }]));
  return { dataset: { exerciseId: step.exercise.id, setNumber: String(step.setNumber), inputType: step.exercise.input_type || "completion" },
    querySelector: selector => inputs[selector] || null, querySelectorAll: () => Object.values(inputs) };
}

function validateWorkoutSetRow(row, allowIncomplete = false) {
  for (const input of row.querySelectorAll("input, select, textarea")) {
    if (input.checkValidity && !input.checkValidity()) {
      input.reportValidity();
      throw new Error("Check the highlighted result before saving.");
    }
  }
  if (allowIncomplete) {
    const log = buildLogRowFromSetRow(row);
    log.completed = hasRequiredWorkoutResults(row);
    return log;
  }
  const type = row.dataset.inputType;
  const required = {
    weight_reps: [".set-weight-input", ".set-reps-input"],
    band_color: [".set-reps-input"], time: [".set-time-input"],
    distance: [".set-distance-input"], custom: [".set-note-input"]
  }[type] || [];
  for (const selector of required) {
    if (!hasValue(selector, row)) {
      row.querySelector(selector)?.focus();
      throw new Error("Enter your result before saving. Use 0 for bodyweight or zero reps when appropriate.");
    }
  }
  if (type === "completion" && !isChecked(".set-completed-input", row)) {
    row.querySelector(".set-completed-input")?.focus();
    throw new Error("Mark this set completed before saving.");
  }
  return buildLogRowFromSetRow(row);
}

async function saveSetRow(row) {
  const logRow = validateWorkoutSetRow(row);

  const { error } = await db
    .from("exercise_set_logs")
    .upsert(logRow, {
      onConflict: "workout_assignment_id,member_profile_id,exercise_id,set_number"
    });

  if (error) throw error;

  existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);
  clearWorkoutSetDraft(row);
}

async function saveSetLog(exerciseId, setNumber) {
  if (workoutSessionSaving) return;
  const row = document.querySelector(
    `.set-log-row[data-exercise-id="${exerciseId}"][data-set-number="${setNumber}"]`
  );

  if (!row) {
    showWorkoutSessionMessage("Could not find set row.", true);
    return;
  }

  captureWorkoutSetDraft(row);
  showWorkoutSessionMessage("Saving set...");
  try {
    validateWorkoutSetRow(row);
    setWorkoutSaveBusy(true);
    await saveSetRow(row);
    const steps = getWorkoutSessionSteps(workoutAssignment.workout);
    if (currentSessionStepIndex === steps.length - 1) {
      workoutSessionView = workoutSetDrafts.size ? "overview" : "summary";
      updateWorkoutSessionHistory("replace");
    }
    renderWorkoutSession();
    scrollWorkoutSessionViewIntoPlace();

    showWorkoutSessionToast("Set saved");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not save set.", true);
  } finally { setWorkoutSaveBusy(false); }
}

async function saveCurrentSetAndGoToStep(stepIndex) {
  if (workoutSessionSaving) return;
  const activeStep = document.querySelector(".session-step-card.active");
  const row = activeStep?.querySelector(".set-log-row");

  if (!row) {
    showWorkoutSessionMessage("Could not find current set row.", true);
    return;
  }

  captureWorkoutSetDraft(row);
  if (!hasRequiredWorkoutResults(row)) {
    goToSessionStep(stepIndex);
    showWorkoutSessionToast("Set left incomplete. You can return to it later.");
    return;
  }
  showWorkoutSessionMessage("Saving set...");
  try {
    validateWorkoutSetRow(row);
    setWorkoutSaveBusy(true);
    await saveSetRow(row);
    setWorkoutSaveBusy(false);
    goToSessionStep(stepIndex);
    showWorkoutSessionToast("Set saved");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not save set.", true);
  } finally { setWorkoutSaveBusy(false); }
}

async function finishWorkoutSession() {
  if (workoutSessionSaving || !workoutAssignment) return;
  const row = document.querySelector(".session-step-card.active .set-log-row");
  if (row && hasRequiredWorkoutResults(row)) row.dataset.dirty = "true";
  captureCurrentWorkoutDrafts();
  try {
    setWorkoutSaveBusy(true);
    const saved = await loadExistingSetLogs(workoutAssignment.id);
    const steps = getWorkoutSessionSteps(workoutAssignment.workout);
    const logs = [];
    let invalidEdits = 0;
    for (const step of steps) {
      const draft = workoutSetDrafts.get(`${step.exercise.id}:${step.setNumber}`);
      if (!draft) continue;
      try { logs.push(validateWorkoutSetRow(createWorkoutDraftRow(step, draft), true)); }
      catch { invalidEdits++; }
    }
    const combined = new Map(saved.map(log => [`${log.exercise_id}:${log.set_number}`, log]));
    logs.forEach(log => combined.set(`${log.exercise_id}:${log.set_number}`, log));
    const remaining = steps.filter(step => !combined.get(`${step.exercise.id}:${step.setNumber}`)?.completed).length;
    if (remaining || invalidEdits) {
      const warning = `${remaining} of ${steps.length} sets are incomplete. Finish anyway? Entered results will be saved and unfinished sets will stay incomplete.`
        + (invalidEdits ? ` ${invalidEdits} invalid entr${invalidEdits === 1 ? "y cannot" : "ies cannot"} be saved; those edits will be discarded.` : "");
      if (!window.confirm(warning)) return;
    }
    showWorkoutSessionMessage("Saving workout progress...");
    if (logs.length) {
      const { error } = await db.from("exercise_set_logs").upsert(logs, {
        onConflict: "workout_assignment_id,member_profile_id,exercise_id,set_number"
      });
      if (error) throw error;
    }
    existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);
    workoutSetDrafts.clear();
    document.querySelectorAll(".set-log-row").forEach(clearWorkoutSetDraft);
    workoutSessionView = "summary";
    updateWorkoutSessionHistory("replace");
    renderWorkoutSession();
    scrollWorkoutSessionViewIntoPlace();
    showWorkoutSessionMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not finish. Your edits are still here; try again.", true);
  } finally { setWorkoutSaveBusy(false); }
}

async function saveAllSetLogs() {
  if (workoutSessionSaving) return;
  const setRows = Array.from(document.querySelectorAll(".set-log-row"));

  if (!setRows.length) {
    showWorkoutSessionMessage("No sets found to save.", true);
    return;
  }

  showWorkoutSessionMessage("Saving all sets...");

  try {
    const logRows = setRows.map(row => validateWorkoutSetRow(row));
    setWorkoutSaveBusy(true);

    const { error } = await db
      .from("exercise_set_logs")
      .upsert(logRows, {
        onConflict: "workout_assignment_id,member_profile_id,exercise_id,set_number"
      });

    if (error) throw error;

    existingSetLogs = await loadExistingSetLogs(workoutAssignment.id);
    setRows.forEach(clearWorkoutSetDraft);
    renderWorkoutSession();

    showWorkoutSessionToast("All sets saved");
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not save all sets.", true);
  } finally { setWorkoutSaveBusy(false); }
}

async function refreshWorkoutSession() {
  if (workoutSessionSaving || !confirmDiscardWorkoutDrafts()) return;
  workoutSetDrafts.clear();
  document.querySelectorAll(".set-log-row").forEach(row => { row.dataset.dirty = "false"; });
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

    [workoutAssignment] = await window.RipCityWorkoutData
      .loadAssignmentAttributions([workoutAssignment]);

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
  if (workoutSessionSaving || !confirmDiscardWorkoutDrafts()) return;
  try { await db.auth.signOut(); }
  catch (error) { showWorkoutSessionMessage(error.message || "Could not log out.", true); return; }
  workoutSessionLeaving = true;
  window.location.href = "login.html";
}

function getWorkoutSessionMemberTypeLabel() {
  if(workoutSessionAccess?.membership?.program_key) return window.RipCityAccess.getProgramLabel(workoutSessionAccess.facilityConfig,workoutSessionAccess.membership.program_key);
  const profileType = String(workoutMemberProfile?.member_type || "").toLowerCase();
  const role = String(workoutSessionAccess?.membership?.role || "").toLowerCase();

  if (profileType === "h2k" || role === "h2k_member") {
    return window.RipCityAccess.getProgramLabel(workoutSessionAccess?.facilityConfig, "h2k");
  }
  if (profileType === "athlete" || role === "athlete") {
    return window.RipCityAccess.getProgramLabel(workoutSessionAccess?.facilityConfig, "athlete");
  }

  return "Member";
}

function updateWorkoutSessionShell() {
  const subtitle = document.getElementById("workout-session-brand-subtitle");

  if (subtitle) {
    subtitle.textContent = getWorkoutSessionMemberTypeLabel();
  }

  window.RipCityMemberNav?.setH2KVisibility(true);

  document.querySelectorAll(".member-role-pending").forEach(element => {
    element.classList.remove("member-role-pending");
  });
}

function updateWorkoutSessionHistory(method = "replace") {
  const state = {
    ...(window.history.state || {}),
    ripCityWorkoutSessionView: workoutSessionView,
    ripCityWorkoutSessionStep: currentSessionStepIndex
  };

  if (method === "push") {
    window.history.pushState(state, "", window.location.href);
    return;
  }

  window.history.replaceState(state, "", window.location.href);
}

function handleWorkoutSessionHistory(event) {
  if (workoutSessionSaving) { updateWorkoutSessionHistory("replace"); return; }
  if (!workoutAssignment || !event.state?.ripCityWorkoutSessionView) return;

  workoutSessionView = event.state.ripCityWorkoutSessionView;
  currentSessionStepIndex = Number(event.state.ripCityWorkoutSessionStep || 0);
  renderWorkoutSession();
  scrollWorkoutSessionViewIntoPlace();
}

async function initWorkoutSessionPage() {
  showWorkoutSessionMessage("Checking access...");

  try {
    workoutSessionAccess = await requireApprovedWorkoutMember();

    if (!workoutSessionAccess) return;

    workoutMemberProfile = await getWorkoutMemberProfile(workoutSessionAccess.membership.id);
    updateWorkoutSessionShell();
    workoutSessionView = "overview";
    currentSessionStepIndex = 0;
    updateWorkoutSessionHistory("replace");

    await refreshWorkoutSession();
    scrollWorkoutSessionViewIntoPlace();
  } catch (error) {
    console.error(error);
    showWorkoutSessionMessage(error.message || "Could not open workout.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initWorkoutSessionPage();

  document.getElementById("finish-workout-btn")?.addEventListener("click", finishWorkoutSession);
  document.getElementById("refresh-session-btn")?.addEventListener("click", refreshWorkoutSession);
  document.getElementById("workout-session-logout-btn")?.addEventListener("click", logoutWorkoutSession);
});

window.addEventListener("popstate", handleWorkoutSessionHistory);
window.addEventListener("beforeunload", event => {
  if (workoutSessionLeaving) return;
  if (workoutSessionSaving || workoutSetDrafts.size) {
    event.preventDefault();
    event.returnValue = "";
  }
});
