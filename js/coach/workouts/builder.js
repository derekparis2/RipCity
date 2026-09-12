// =====================================================
// COACH WORKOUT BUILDER
// =====================================================
// Owns the block and exercise form UI. Data persistence remains in the page
// controller until workout versioning is introduced.

function applyExerciseTemplateToCard(card, templateId) {
  const template = exerciseTemplates.find(row => row.id === templateId);
  if (!template) return;

  card.querySelector(".exercise-template-id").value = template.id;
  card.querySelector(".exercise-template-search").value = template.name || "";
  card.querySelector(".exercise-name").value = template.name || "";
  card.querySelector(".exercise-description").value = template.description || "";
  card.querySelector(".exercise-input-type").value = template.input_type || "completion";
  card.querySelector(".exercise-video").value = template.video_url || "";
  card.querySelector(".exercise-coach-note").value = template.coach_note || "";
  updateExerciseTargetField(card);
}

function applyExerciseTemplateSearch(card) {
  const searchInput = card.querySelector(".exercise-template-search");
  const hiddenInput = card.querySelector(".exercise-template-id");
  if (!searchInput || !hiddenInput) return;

  const search = searchInput.value.trim().toLowerCase();
  const template = findExerciseTemplateByName(search);

  if (!template) {
    hiddenInput.value = "";
    return;
  }

  applyExerciseTemplateToCard(card, template.id);
}

function getLastOrCreateBuilderBlock() {
  let blockCards = Array.from(document.querySelectorAll("[data-block-card]"));
  let blockCard = blockCards[blockCards.length - 1];

  if (!blockCard) {
    addBlockCard();
    blockCards = Array.from(document.querySelectorAll("[data-block-card]"));
    blockCard = blockCards[blockCards.length - 1];
  }

  return blockCard;
}

function addTemplateToBuilder(templateId) {
  if (!templateId) return;

  const blockCard = getLastOrCreateBuilderBlock();
  if (!blockCard) return;

  addExerciseToBlock(blockCard);

  const exerciseCard = blockCard
    .querySelector("[data-block-exercise-list]")
    ?.lastElementChild;

  if (!exerciseCard) return;

  applyExerciseTemplateToCard(exerciseCard, templateId);
  exerciseCard.scrollIntoView({ behavior: "smooth", block: "center" });
  showExerciseLibraryMessage("Exercise added to the workout builder.");
}

// ----------------------------
// Block / Exercise form UI
// ----------------------------

function getBlockDefaultName(index) {
  const names = ["Warmup", "A Block", "B Block", "C Block", "Finisher"];
  return names[index - 1] || `Block ${index}`;
}

function getExerciseRowLabel(index) {
  return String(index + 1);
}

function getExerciseTargetLabel(inputType) {
  const labels = {
    weight_reps: "Reps / Set Targets",
    band_color: "Band / Rep Target",
    time: "Time Target",
    distance: "Distance Target",
    completion: "Task Target",
    custom: "Target"
  };

  return labels[inputType] || "Reps / Set Targets";
}

function getExerciseTargetPlaceholder(inputType) {
  const placeholders = {
    weight_reps: "5 or 5,4,3,4,5",
    band_color: "ex: light band or 8 reps",
    time: "ex: 20 sec or 20,25,30",
    distance: "ex: 20 yards",
    completion: "ex: 3 rounds or complete",
    custom: "Enter target"
  };

  return placeholders[inputType] || placeholders.weight_reps;
}

function getSetTargetHint(repsValue, setsValue) {
  const raw = String(repsValue || "").trim();
  if (!raw) return "Add target";

  const targets = raw
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const sets = Number(setsValue || 0);

  if (targets.length > 1) {
    return `${targets.length} set targets: ${targets.join(" / ")}`;
  }

  if (sets > 1) {
    return `${sets} sets x ${raw}`;
  }

  return raw;
}

function getExerciseSummary(card, index) {
  const name = card.querySelector(".exercise-name")?.value.trim() || `Exercise ${index + 1}`;
  const sets = card.querySelector(".exercise-sets")?.value || "";
  const reps = card.querySelector(".exercise-reps")?.value || "";
  const inputType = card.querySelector(".exercise-input-type")?.value || "weight_reps";

  return {
    label: getExerciseRowLabel(index),
    name,
    target: getSetTargetHint(reps, sets),
    inputType: formatInputTypeLabel(inputType)
  };
}

function getBlockSummary(blockCard) {
  const exerciseCards = Array.from(blockCard.querySelectorAll("[data-exercise-card]"));
  const exerciseNames = exerciseCards
    .map((card, index) => getExerciseSummary(card, index).name)
    .filter(Boolean);
  const maxSets = Math.max(
    0,
    ...exerciseCards.map(card => Number(card.querySelector(".exercise-sets")?.value || 0))
  );

  return {
    exerciseCount: exerciseCards.length,
    maxSets,
    exerciseNames
  };
}

function updateExerciseSummary(card) {
  const blockCard = card.closest("[data-block-card]");
  const exerciseCards = Array.from(blockCard?.querySelectorAll("[data-exercise-card]") || []);
  const index = Math.max(0, exerciseCards.indexOf(card));
  const summary = getExerciseSummary(card, index);

  card.querySelector("[data-exercise-row-label]").textContent = summary.label;
  card.querySelector("[data-exercise-summary-name]").textContent = summary.name;
  card.querySelector("[data-exercise-summary-target]").textContent = summary.target;
  card.querySelector("[data-exercise-summary-input]").textContent = summary.inputType;

  updateBlockSummary(blockCard);
}

function updateBlockSummary(blockCard) {
  if (!blockCard) return;

  const summary = getBlockSummary(blockCard);
  const exerciseCount = blockCard.querySelector("[data-block-exercise-count]");
  const roundCount = blockCard.querySelector("[data-block-round-count]");
  const preview = blockCard.querySelector("[data-block-preview]");
  const blockName = blockCard.querySelector(".block-name")?.value.trim() || "Block";
  const headingName = blockCard.querySelector("[data-block-summary-name]");

  if (headingName) headingName.textContent = blockName;
  if (exerciseCount) {
    exerciseCount.textContent = `${summary.exerciseCount} exercise${summary.exerciseCount === 1 ? "" : "s"}`;
  }
  if (roundCount) {
    roundCount.textContent = summary.maxSets
      ? `${summary.maxSets} round${summary.maxSets === 1 ? "" : "s"}`
      : "Rounds not set";
  }
  if (preview) {
    preview.textContent = summary.exerciseNames.length
      ? summary.exerciseNames.slice(0, 4).join(", ")
      : "Add exercises to this block";
  }
}

function updateExerciseTargetField(card) {
  const inputType = card.querySelector(".exercise-input-type")?.value || "weight_reps";
  const label = card.querySelector("[data-exercise-target-label]");
  const repsInput = card.querySelector(".exercise-reps");

  if (label) label.textContent = getExerciseTargetLabel(inputType);
  if (repsInput) repsInput.placeholder = getExerciseTargetPlaceholder(inputType);
}

function setOpenBlock(activeBlock) {
  document.querySelectorAll("[data-block-card]").forEach(blockCard => {
    const shouldOpen = blockCard === activeBlock;
    blockCard.classList.toggle("is-collapsed", !shouldOpen);
    const toggleButton = blockCard.querySelector("[data-toggle-block]");
    if (toggleButton) toggleButton.textContent = shouldOpen ? "Collapse" : "Edit Block";
  });
}

function attachBlockEvents(blockCard) {
  blockCard
    .querySelector(".add-exercise-to-block-btn")
    .addEventListener("click", () => {
      setOpenBlock(blockCard);
      addExerciseToBlock(blockCard);
    });

  blockCard
    .querySelector(".remove-block-btn")
    .addEventListener("click", () => {
      blockCard.remove();
      refreshBlockAndExerciseNumbers();
      const firstBlock = document.querySelector("[data-block-card]");
      if (firstBlock) setOpenBlock(firstBlock);
    });

  blockCard
    .querySelector("[data-toggle-block]")
    .addEventListener("click", () => {
      const isCollapsed = blockCard.classList.contains("is-collapsed");
      if (isCollapsed) {
        setOpenBlock(blockCard);
      } else {
        blockCard.classList.add("is-collapsed");
        blockCard.querySelector("[data-toggle-block]").textContent = "Edit Block";
      }
    });

  blockCard
    .querySelector(".block-name")
    .addEventListener("input", () => updateBlockSummary(blockCard));
}

function createBlockCard(index) {
  // A block is a coach-facing group such as Warmup, A Block, or Finisher.
  const defaultName = getBlockDefaultName(index);

  return `
    <article class="workout-block-card" data-block-card>
      <div class="block-card-heading">
        <div>
          <p class="eyebrow">BLOCK ${index}</p>
          <h4 data-block-summary-name>${window.RipCityUI.text(defaultName)}</h4>
          <input
            type="text"
            class="block-name"
            value="${window.RipCityUI.attr(defaultName)}"
            placeholder="Warmup, A Block, B Block, Finisher..."
            required
          />
          <div class="block-summary-meta">
            <span data-block-exercise-count>0 exercises</span>
            <span data-block-round-count>Rounds not set</span>
          </div>
          <p class="block-summary-preview" data-block-preview>Add exercises to this block</p>
        </div>

        <div class="block-actions">
          <button class="outline-btn" type="button" data-toggle-block>
            Collapse
          </button>
          <button class="outline-btn add-exercise-to-block-btn" type="button">
            Add Exercise
          </button>
          <button class="outline-btn remove-block-btn" type="button">
            Remove Block
          </button>
        </div>
      </div>

      <div class="block-exercise-list" data-block-exercise-list></div>
    </article>
  `;
}

function createExerciseCard(index) {
  // Exercise fields map directly to workout_exercises columns.
  const templateListId = `exercise-template-list-${createClientId()}`;
  const exerciseLabel = getExerciseRowLabel(index - 1);

  return `
    <article class="exercise-builder-card" data-exercise-card>
      <div class="exercise-quick-row">
        <div class="exercise-row-label" data-exercise-row-label>${exerciseLabel}</div>

        <label class="exercise-name-label">
          Exercise
          <input
            type="text"
            class="exercise-name exercise-template-search"
            list="${window.RipCityUI.attr(templateListId)}"
            placeholder="Type to search library..."
            autocomplete="off"
            required
          />
          <datalist id="${window.RipCityUI.attr(templateListId)}"></datalist>
        </label>

        <label>
          Sets
          <input type="number" class="exercise-sets" placeholder="3" />
        </label>

        <label>
          <span data-exercise-target-label>Reps / Set Targets</span>
          <input type="text" class="exercise-reps" placeholder="5 or 5,4,3,4,5" />
        </label>

        <label>
          Input
          <select class="exercise-input-type">
            <option value="weight_reps">Weight + Reps</option>
            <option value="completion">Completion</option>
            <option value="band_color">Band Color</option>
            <option value="time">Time</option>
            <option value="distance">Distance</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <div class="exercise-row-actions">
          <button class="outline-btn small-inline-btn toggle-exercise-details-btn" type="button">
            Details
          </button>
          <button class="outline-btn small-inline-btn remove-exercise-btn" type="button">
            Remove
          </button>
        </div>
      </div>

      <input type="hidden" class="exercise-template-id" />

      <div class="exercise-row-summary">
        <strong data-exercise-summary-name>Exercise ${exerciseLabel}</strong>
        <span data-exercise-summary-target>Add target</span>
        <span data-exercise-summary-input>Weight + Reps</span>
      </div>

      <div class="exercise-details-panel hidden" data-exercise-details>
      <label>
        Description / Details
        <textarea class="exercise-description" rows="2" placeholder="Coaching cues, setup, or notes..."></textarea>
      </label>

      <div class="form-row">
        <label>
          Tempo
          <input type="text" class="exercise-tempo" placeholder="3-1-1" />
        </label>

        <label>
          Rest Time
          <input type="text" class="exercise-rest" placeholder="90 sec" />
        </label>
      </div>

      <div class="form-row">
        <label>
          Video URL
          <input type="text" class="exercise-video" placeholder="Optional demo link" />
        </label>
      </div>

      <label>
        Coach Note
        <input type="text" class="exercise-coach-note" placeholder="Optional note for members" />
      </label>
      </div>
    </article>
  `;
}

function refreshBlockAndExerciseNumbers() {
  // Renumber visible labels after deleting blocks/exercises.
  document.querySelectorAll("[data-block-card]").forEach((blockCard, blockIndex) => {
    const eyebrow = blockCard.querySelector(".eyebrow");
    if (eyebrow) eyebrow.textContent = `BLOCK ${blockIndex + 1}`;

    blockCard.querySelectorAll("[data-exercise-card]").forEach((exerciseCard, exerciseIndex) => {
      exerciseCard.querySelector("[data-exercise-row-label]").textContent = getExerciseRowLabel(exerciseIndex);
      updateExerciseSummary(exerciseCard);
    });

    updateBlockSummary(blockCard);
  });
}

function addExerciseToBlock(blockCard) {
  const list = blockCard.querySelector("[data-block-exercise-list]");
  const count = list.querySelectorAll("[data-exercise-card]").length + 1;

  list.insertAdjacentHTML("beforeend", createExerciseCard(count));

  const newestCard = list.lastElementChild;
  const removeButton = newestCard.querySelector(".remove-exercise-btn");
  const templateSearch = newestCard.querySelector(".exercise-template-search");
  const detailsButton = newestCard.querySelector(".toggle-exercise-details-btn");

  renderExerciseTemplatePicker(templateSearch);

  templateSearch.addEventListener("input", () => {
    applyExerciseTemplateSearch(newestCard);
  });

  templateSearch.addEventListener("change", () => {
    applyExerciseTemplateSearch(newestCard);
    updateExerciseSummary(newestCard);
  });

  newestCard.querySelectorAll("input, select, textarea").forEach(input => {
    input.addEventListener("input", () => updateExerciseSummary(newestCard));
    input.addEventListener("change", () => updateExerciseSummary(newestCard));
  });

  newestCard.querySelector(".exercise-input-type")?.addEventListener("change", () => {
    updateExerciseTargetField(newestCard);
    updateExerciseSummary(newestCard);
  });

  detailsButton.addEventListener("click", () => {
    const panel = newestCard.querySelector("[data-exercise-details]");
    const hidden = panel.classList.toggle("hidden");
    detailsButton.textContent = hidden ? "Details" : "Hide Details";
  });

  removeButton.addEventListener("click", () => {
    newestCard.remove();
    refreshBlockAndExerciseNumbers();
  });

  updateExerciseSummary(newestCard);
  updateExerciseTargetField(newestCard);
}

function setExerciseCardValues(card, exercise = {}) {
  const template = exerciseTemplates.find(row => row.id === exercise.exercise_template_id);
  card.querySelector(".exercise-template-id").value = exercise.exercise_template_id || "";
  card.querySelector(".exercise-template-search").value = template?.name || "";
  card.querySelector(".exercise-name").value = exercise.name || "";
  card.querySelector(".exercise-description").value = exercise.description || "";
  card.querySelector(".exercise-sets").value = exercise.sets || "";
  card.querySelector(".exercise-reps").value = exercise.reps || "";
  card.querySelector(".exercise-tempo").value = exercise.tempo || "";
  card.querySelector(".exercise-rest").value = exercise.rest_time || "";
  card.querySelector(".exercise-input-type").value = exercise.input_type || "weight_reps";
  card.querySelector(".exercise-video").value = exercise.video_url || "";
  card.querySelector(".exercise-coach-note").value = exercise.coach_note || "";
  updateExerciseTargetField(card);
  updateExerciseSummary(card);
}

function addBlockCard() {
  const list = document.getElementById("block-list");
  const count = document.querySelectorAll("[data-block-card]").length + 1;

  list.insertAdjacentHTML("beforeend", createBlockCard(count));

  const newestBlock = list.lastElementChild;

  attachBlockEvents(newestBlock);

  // Start every new block with one exercise so the coach can type immediately.
  addExerciseToBlock(newestBlock);
  setOpenBlock(newestBlock);
}

function loadWorkoutIntoBuilder(workout) {
  if (!workout) return;

  setFieldValue("workout-title", `${workout.title || "Workout"} Copy`);
  setFieldValue("workout-focus", workout.focus || "");
  setFieldValue("workout-minutes", workout.estimated_minutes || "");
  setFieldValue("workout-description", workout.description || "");

  const list = document.getElementById("block-list");
  list.innerHTML = "";

  const blocks = [...(workout.workout_blocks || [])]
    .sort((a, b) => a.block_order - b.block_order);

  if (!blocks.length) {
    addBlockCard();
    return;
  }

  blocks.forEach((block, blockIndex) => {
    list.insertAdjacentHTML("beforeend", createBlockCard(blockIndex + 1));
    const blockCard = list.lastElementChild;
    blockCard.querySelector(".block-name").value = block.name || `Block ${blockIndex + 1}`;

    attachBlockEvents(blockCard);

    const exercises = [...(block.workout_exercises || [])]
      .sort((a, b) => a.exercise_order - b.exercise_order);

    if (!exercises.length) {
      addExerciseToBlock(blockCard);
      return;
    }

    exercises.forEach(exercise => {
      addExerciseToBlock(blockCard);
      setExerciseCardValues(blockCard.querySelector("[data-block-exercise-list]").lastElementChild, exercise);
    });

    updateBlockSummary(blockCard);
  });

  const firstBlock = document.querySelector("[data-block-card]");
  if (firstBlock) setOpenBlock(firstBlock);

  document.getElementById("workout-form")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showWorkoutMessage("Workout loaded into builder. Save it to create a new assigned workout.");
}

function getBlockFormData() {
  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));

  return blockCards.map((blockCard, blockIndex) => {
    const blockName = blockCard.querySelector(".block-name").value.trim();
    const exerciseCards = Array.from(blockCard.querySelectorAll("[data-exercise-card]"));

    const exercises = exerciseCards.map((card, exerciseIndex) => {
      const exerciseName = card.querySelector(".exercise-name").value.trim();
      const templateId = getCardInputValue(card, ".exercise-template-id") || null;
      const linkedTemplate = exerciseTemplates.find(template => template.id === templateId);
      const templateStillMatchesName = linkedTemplate &&
        normalizeExerciseName(linkedTemplate.name) === normalizeExerciseName(exerciseName);

      return {
        name: exerciseName,
        description: card.querySelector(".exercise-description").value.trim() || null,
        sets: card.querySelector(".exercise-sets").value
          ? Number(card.querySelector(".exercise-sets").value)
          : null,
        reps: card.querySelector(".exercise-reps").value.trim() || null,
        tempo: card.querySelector(".exercise-tempo").value.trim() || null,
        rest_time: card.querySelector(".exercise-rest").value.trim() || null,
        input_type: card.querySelector(".exercise-input-type").value,
        exercise_template_id: templateStillMatchesName ? templateId : null,
        video_url: card.querySelector(".exercise-video").value.trim() || null,
        coach_note: card.querySelector(".exercise-coach-note").value.trim() || null,
        exercise_order: exerciseIndex
      };
    }).filter(exercise => exercise.name);

    return {
      name: blockName,
      block_order: blockIndex,
      exercises
    };
  }).filter(block => block.name && block.exercises.length);
}


