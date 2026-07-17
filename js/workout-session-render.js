// =====================================================
// WORKOUT SESSION RENDERING
// =====================================================
// Converts the loaded workout assignment into the round/superset UI.
// Save handlers are attached after each render because the DOM is rebuilt.

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

  return window.RipCityWorkoutData.getWorkoutExercises(workout);
}

function getTotalSetCount() {
  return window.RipCityWorkoutData.getWorkoutTotalSets(workoutAssignment.workout);
}

function getCompletedSetCount() {
  return existingSetLogs.filter(log => log.completed).length;
}

function updateSetStats() {
  const complete = getCompletedSetCount();
  const total = getTotalSetCount();
  const progressPercent = total ? Math.round((complete / total) * 100) : 0;

  document.getElementById("session-sets-complete").textContent = complete;
  document.getElementById("session-sets-total").textContent = total;

  const mobileComplete = document.getElementById("mobile-session-sets-complete");
  const mobileTotal = document.getElementById("mobile-session-sets-total");
  const progressLabel = document.getElementById("session-progress-percent");
  const progressFill = document.getElementById("session-progress-fill");

  if (mobileComplete) mobileComplete.textContent = complete;
  if (mobileTotal) mobileTotal.textContent = total;
  if (progressLabel) progressLabel.textContent = progressPercent;
  if (progressFill) progressFill.style.width = `${progressPercent}%`;
}

function renderWorkoutSession() {
  const container = document.getElementById("workout-session-container");
  const workout = workoutAssignment.workout;
  const steps = getWorkoutSessionSteps(workout);

  if (!steps.length) {
    container.innerHTML = `<div class="empty-state">This workout has no blocks yet.</div>`;
    return;
  }

  currentSessionStepIndex = Math.min(
    Math.max(currentSessionStepIndex, 0),
    steps.length - 1
  );

  container.innerHTML = `
    <div class="session-step-shell">
      <div class="session-step-topbar">
        <div>
          <p class="eyebrow">SET BY SET</p>
          <h3>Step ${currentSessionStepIndex + 1} of ${steps.length}</h3>
        </div>
      </div>

      <div class="session-step-progress">
        ${steps.map((step, index) => `
          <button
            class="session-step-dot ${index === currentSessionStepIndex ? "active" : ""} ${isStepComplete(step) ? "complete" : ""}"
            type="button"
            data-session-step-index="${index}"
            aria-label="Go to step ${index + 1}"
          >
            ${index + 1}
          </button>
        `).join("")}
      </div>

      <div class="session-step-list">
        ${steps.map((step, index) => renderWorkoutStep(step, index)).join("")}
      </div>
    </div>
  `;

  document.querySelectorAll(".save-set-btn").forEach(button => {
    button.addEventListener("click", () => {
      saveSetLog(button.dataset.exerciseId, Number(button.dataset.setNumber));
    });
  });

  document.querySelectorAll("[data-session-step-index]").forEach(button => {
    button.addEventListener("click", () => {
      goToSessionStep(Number(button.dataset.sessionStepIndex));
    });
  });

  document.querySelectorAll(".session-previous-step-btn").forEach(button => {
    button.addEventListener("click", () => {
      goToSessionStep(Number(button.dataset.previousStepIndex));
    });
  });

  document.querySelectorAll(".session-next-step-btn").forEach(button => {
    button.addEventListener("click", () => {
      saveCurrentSetAndGoToStep(Number(button.dataset.nextStepIndex));
    });
  });

  updateSetStats();
}

function getWorkoutSessionSteps(workout) {
  const blocks = window.RipCityWorkoutData.getWorkoutBlocks(workout);
  const steps = [];

  blocks.forEach(block => {
    const exercises = window.RipCityWorkoutData.getBlockExercises(block);

    if (!exercises.length) return;

    const maxSets = Math.max(
      ...exercises.map(exercise => Number(exercise.sets || 1))
    );

    for (let roundNumber = 1; roundNumber <= maxSets; roundNumber++) {
      const exercisesForRound = exercises.filter(exercise => {
        const totalSets = Number(exercise.sets || 1);
        return roundNumber <= totalSets;
      });

      exercisesForRound.forEach((exercise, exerciseIndex) => {
        steps.push({
          block,
          exercise,
          exerciseIndex,
          roundExerciseCount: exercisesForRound.length,
          roundNumber,
          setNumber: roundNumber
        });
      });
    }
  });

  return steps;
}

function isStepComplete(step) {
  return Boolean(findExistingLog(step.exercise.id, step.setNumber)?.completed);
}

function goToSessionStep(stepIndex) {
  const workout = workoutAssignment?.workout;
  if (!workout) return;

  const steps = getWorkoutSessionSteps(workout);
  currentSessionStepIndex = Math.min(Math.max(stepIndex, 0), steps.length - 1);
  renderWorkoutSession();

  document.getElementById("workout-session-container")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderWorkoutStep(step, index) {
  const isActive = index === currentSessionStepIndex;
  const label = getExerciseBlockLabel(step.exerciseIndex);

  return `
    <article class="session-step-card ${isActive ? "active" : ""}" data-session-step="${index}">
      <div class="session-block-heading">
        <div>
          <p class="eyebrow">${window.RipCityUI.text(step.block.name)}</p>
          <h3>Round ${step.roundNumber}: ${label} Movement</h3>
        </div>
        <span>${step.roundExerciseCount} movement${step.roundExerciseCount === 1 ? "" : "s"} this round</span>
      </div>

      <div class="round-exercise-item">
        <div class="round-exercise-label">${label}</div>
        ${renderExerciseSetLogger(step.exercise, step.setNumber, index)}
      </div>
    </article>
  `;
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
          <div>
            <p class="eyebrow">ROUND ${roundNumber}</p>
            <h4>Set ${roundNumber}</h4>
          </div>
          <span>${exercisesForRound.length} movement${exercisesForRound.length === 1 ? "" : "s"}</span>
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

function renderExerciseSetLogger(exercise, setNumber, stepIndex = null) {
  const targetDetails = [
    `<span><strong>Target</strong>${getExerciseTargetText(exercise)}</span>`,
    exercise.tempo ? `<span><strong>Tempo</strong>${exercise.tempo}</span>` : "",
    exercise.rest_time ? `<span><strong>Rest</strong>${exercise.rest_time}</span>` : "",
    exercise.percentage ? `<span><strong>Load</strong>${exercise.percentage}</span>` : "",
    `<span><strong>Input</strong>${formatInputType(exercise.input_type)}</span>`
  ].filter(Boolean).join("");

  return `
    <article class="session-exercise-card">
      <div class="session-exercise-header">
        <div>
          <h4>${window.RipCityUI.text(exercise.name)}</h4>
          <p>${window.RipCityUI.text(exercise.description, "No description added.")}</p>
        </div>

        <div class="session-exercise-tags">
          ${targetDetails}
        </div>
      </div>

      ${exercise.coach_note ? `
        <div class="session-coach-note">
          <strong>Coach Note</strong>
          <p>${window.RipCityUI.text(exercise.coach_note)}</p>
        </div>
      ` : ""}

      <div class="set-log-list">
        ${renderSetLogger(exercise, setNumber, stepIndex)}
      </div>
    </article>
  `;
}

function renderSetLogger(exercise, setNumber, stepIndex = null) {
  const existing = findExistingLog(exercise.id, setNumber);
  const completed = existing?.completed || false;
  const showNoteInput = exercise.input_type !== "custom";
  const hasStepperActions = Number.isInteger(stepIndex);
  const totalSteps = hasStepperActions
    ? getWorkoutSessionSteps(workoutAssignment.workout).length
    : 0;
  const isFirstStep = hasStepperActions && stepIndex === 0;
  const isLastStep = hasStepperActions && stepIndex === totalSteps - 1;

  return `
    <div
      class="set-log-row ${completed ? "set-complete" : ""}"
      data-exercise-id="${window.RipCityUI.attr(exercise.id)}"
      data-set-number="${window.RipCityUI.attr(setNumber)}"
    >
      <div class="set-log-title">
        <div>
          <strong>Set ${setNumber}</strong>
          <span>Member actuals</span>
        </div>
        <em>${completed ? "Saved" : "Not saved"}</em>
      </div>

      <div class="set-log-fields">
        ${renderInputsForExerciseType(exercise, existing, setNumber)}

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

        ${showNoteInput ? `
          <label class="set-note-label">
            Note
            <input
              type="text"
              class="set-note-input"
              value="${window.RipCityUI.attr(existing?.athlete_note || "")}"
              placeholder="Optional note"
            />
          </label>
        ` : ""}
      </div>

      <div class="set-log-actions">
        ${hasStepperActions ? `
          <button
            class="outline-btn session-previous-step-btn"
            type="button"
            data-previous-step-index="${stepIndex - 1}"
            ${isFirstStep ? "disabled" : ""}
          >
            Previous
          </button>
        ` : ""}

        <button
          class="outline-btn save-set-btn"
          type="button"
          data-exercise-id="${window.RipCityUI.attr(exercise.id)}"
          data-set-number="${window.RipCityUI.attr(setNumber)}"
        >
          Save Set
        </button>

        ${hasStepperActions ? `
          <button
            class="primary-btn session-next-step-btn"
            type="button"
            data-next-step-index="${stepIndex + 1}"
            ${isLastStep ? "disabled" : ""}
          >
            Save & Next
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderInputsForExerciseType(exercise, existing, setNumber) {
  if (exercise.input_type === "weight_reps") {
    const previousWeight = findPreviousWeightForExercise(exercise.id, setNumber);
    const previousReps = findPreviousRepsForExercise(exercise.id, setNumber);

    const weightValue = existing?.weight ?? previousWeight;
    const repsValue = existing?.reps_completed ?? previousReps;

    return `
      <div class="set-input-grid">
        <label>
          Actual Weight
          <input
            type="number"
            class="set-weight-input"
            value="${window.RipCityUI.attr(weightValue)}"
            placeholder="ex: 185"
          />
        </label>

        <label>
          Actual Reps
          <input
            type="number"
            class="set-reps-input"
            value="${window.RipCityUI.attr(repsValue || "")}"
            placeholder="${window.RipCityUI.attr(exercise.reps || "reps")}"
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
          value="${window.RipCityUI.attr(existing?.band_color || "")}"
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
          value="${window.RipCityUI.attr(existing?.time_value || "")}"
          placeholder="${window.RipCityUI.attr(exercise.reps || "ex: 10.4 sec")}"
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
          value="${window.RipCityUI.attr(existing?.distance_value || "")}"
          placeholder="${window.RipCityUI.attr(exercise.reps || "ex: 20 yards")}"
        />
      </label>
    `;
  }

  if (exercise.input_type === "custom") {
    return `
      <label>
        Actual Result
        <input
          type="text"
          class="set-note-input"
          value="${window.RipCityUI.attr(existing?.athlete_note || "")}"
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
