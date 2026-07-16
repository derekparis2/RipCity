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

  const blocks = window.RipCityWorkoutData.getWorkoutBlocks(workout);

  if (!blocks.length) {
    container.innerHTML = `<div class="empty-state">This workout has no blocks yet.</div>`;
    return;
  }

  container.innerHTML = blocks.map(block => {
    const exercises = window.RipCityWorkoutData.getBlockExercises(block);

    return `
      <article class="session-block-card">
        <div class="session-block-heading">
          <div>
            <p class="eyebrow">BLOCK</p>
            <h3>${window.RipCityUI.text(block.name)}</h3>
          </div>
          <span>${exercises.length} exercise${exercises.length === 1 ? "" : "s"}</span>
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

function renderExerciseSetLogger(exercise, setNumber) {
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
        ${renderSetLogger(exercise, setNumber)}
      </div>
    </article>
  `;
}

function renderSetLogger(exercise, setNumber) {
  const existing = findExistingLog(exercise.id, setNumber);
  const completed = existing?.completed || false;
  const showNoteInput = exercise.input_type !== "custom";

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

      <button
        class="primary-btn save-set-btn"
        type="button"
        data-exercise-id="${window.RipCityUI.attr(exercise.id)}"
        data-set-number="${window.RipCityUI.attr(setNumber)}"
      >
        Save Set
      </button>
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
