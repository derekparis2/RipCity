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
  card.querySelector(".exercise-unilateral").checked = Boolean(template.is_unilateral);
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

// ----------------------------
// Block / Exercise form UI
// ----------------------------

let draggedBuilderItem = null;

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
    band_color: "Rep Target",
    time: "Time Target",
    distance: "Distance Target",
    completion: "Target / Prescribed Distance",
    custom: "Target"
  };

  return labels[inputType] || "Reps / Set Targets";
}

function getExerciseTargetPlaceholder(inputType) {
  const placeholders = {
    weight_reps: "5 or 5,4,3,4,5",
    band_color: "ex: 12 or 12,12,10",
    time: "ex: 20 sec or 20,25,30",
    distance: "ex: 20 yards",
    completion: "ex: 20 yards, 8 reps, or complete",
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
  const isUnilateral = card.querySelector(".exercise-unilateral")?.checked || false;
  const target = getSetTargetHint(reps, sets);

  return {
    label: getExerciseRowLabel(index),
    name,
    target: isUnilateral
      ? `${target === "Add target" ? "Target" : target} each side`
      : target,
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

  updateWorkoutBuilderReview();
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

  updateWorkoutBuilderOutline();
}

function clearBuilderDragState() {
  document.querySelectorAll(".is-dragging, .drop-before, .drop-after, .drop-at-end").forEach(element => {
    element.classList.remove("is-dragging", "drop-before", "drop-after", "drop-at-end");
  });
  draggedBuilderItem = null;
}

function finishBuilderDrag(card) {
  const destinationBlock = card.closest("[data-block-card]");
  clearBuilderDragState();
  refreshBlockAndExerciseNumbers();
  if (destinationBlock) setOpenBlock(destinationBlock);
  markWorkoutFormDirty();
}

function showBuilderDropLine(target, placement) {
  document.querySelectorAll(".drop-before, .drop-after, .drop-at-end").forEach(element => {
    element.classList.remove("drop-before", "drop-after", "drop-at-end");
  });

  target.classList.add(placement === "inside" ? "drop-at-end" : `drop-${placement}`);
}

function setBuilderDropDestination({ targetCard = null, targetList = null, placement = "after" }) {
  if (!draggedBuilderItem) return;
  draggedBuilderItem.targetCard = targetCard;
  draggedBuilderItem.targetList = targetList;
  draggedBuilderItem.placement = placement;
}

function applyBuilderDrop() {
  if (!draggedBuilderItem) return;

  const { card, targetCard, targetList, placement } = draggedBuilderItem;
  if (targetCard) {
    targetCard.parentElement.insertBefore(
      card,
      placement === "before" ? targetCard : targetCard.nextElementSibling
    );
  } else if (targetList) {
    targetList.append(card);
  }

  finishBuilderDrag(card);
}

function attachBuilderDragEvents(card, type) {
  const handle = card.querySelector(type === "block" ? ".block-drag-handle" : ".exercise-drag-handle");
  if (!handle) return;

  handle.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    card.querySelector(".builder-more-menu")?.setAttribute("open", "");
  });

  handle.addEventListener("dragstart", event => {
    event.stopPropagation();
    draggedBuilderItem = { card, type };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", type);
    event.dataTransfer.setDragImage(card, Math.min(36, card.offsetWidth / 2), 24);
    card.classList.add("is-dragging");
  });

  card.addEventListener("dragover", event => {
    if (!draggedBuilderItem || draggedBuilderItem.type !== type || draggedBuilderItem.card === card) return;

    event.preventDefault();
    event.stopPropagation();
    const bounds = card.getBoundingClientRect();
    const insertBefore = event.clientY < bounds.top + bounds.height / 2;
    const placement = insertBefore ? "before" : "after";
    showBuilderDropLine(card, placement);
    setBuilderDropDestination({ targetCard: card, placement });
  });

  card.addEventListener("drop", event => {
    if (!draggedBuilderItem || draggedBuilderItem.type !== type) return;
    event.preventDefault();
    event.stopPropagation();
    applyBuilderDrop();
  });
  handle.addEventListener("dragend", () => {
    if (!draggedBuilderItem || draggedBuilderItem.card !== card) return;
    clearBuilderDragState();
  });
}

function attachBlockEvents(blockCard) {
  attachBuilderDragEvents(blockCard, "block");

  blockCard.addEventListener("dragover", event => {
    if (draggedBuilderItem?.type !== "exercise" || event.target.closest("[data-exercise-card]")) return;
    event.preventDefault();
    showBuilderDropLine(blockCard, "inside");
    setBuilderDropDestination({
      targetList: blockCard.querySelector("[data-block-exercise-list]"),
      placement: "inside"
    });
  });

  blockCard.addEventListener("drop", event => {
    if (draggedBuilderItem?.type !== "exercise" || event.target.closest("[data-exercise-card]")) return;
    event.preventDefault();
    applyBuilderDrop();
  });

  blockCard
    .querySelector(".add-exercise-to-block-btn")
    .addEventListener("click", () => {
      setOpenBlock(blockCard);
      addExerciseToBlock(blockCard);
    });

  blockCard
    .querySelector("[data-remove-block]")
    .addEventListener("click", () => {
      if (!confirmBlockRemoval(blockCard)) return;

      blockCard.remove();
      refreshBlockAndExerciseNumbers();
      const firstBlock = document.querySelector("[data-block-card]");
      if (firstBlock) setOpenBlock(firstBlock);
      markWorkoutFormDirty();
    });

  blockCard
    .querySelector("[data-move-block-up]")
    .addEventListener("click", () => moveBlockCard(blockCard, -1));

  blockCard
    .querySelector("[data-move-block-down]")
    .addEventListener("click", () => moveBlockCard(blockCard, 1));

  blockCard
    .querySelector("[data-duplicate-block]")
    .addEventListener("click", () => {
      duplicateBlockCard(blockCard);
      closeBuilderMenu(blockCard);
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
    .addEventListener("input", () => {
      updateBlockSummary(blockCard);
    });

  const exerciseList = blockCard.querySelector("[data-block-exercise-list]");
  exerciseList.addEventListener("dragover", event => {
    if (draggedBuilderItem?.type !== "exercise" || event.target !== exerciseList) return;
    event.preventDefault();
    showBuilderDropLine(exerciseList, "inside");
    setBuilderDropDestination({ targetList: exerciseList, placement: "inside" });
  });
  exerciseList.addEventListener("drop", event => {
    if (draggedBuilderItem?.type !== "exercise") return;
    event.preventDefault();
    applyBuilderDrop();
  });
}

function closeBuilderMenu(card) {
  card.querySelector(".builder-more-menu")?.removeAttribute("open");
}

function confirmBlockRemoval(blockCard) {
  const blockName = blockCard.querySelector(".block-name")?.value.trim() || "this block";
  const namedExercises = Array.from(blockCard.querySelectorAll(".exercise-name"))
    .filter(input => input.value.trim());

  if (!namedExercises.length) return true;

  return window.confirm(
    `Remove ${blockName} and its ${namedExercises.length} exercise${namedExercises.length === 1 ? "" : "s"}?`
  );
}

function moveBlockCard(blockCard, direction) {
  const sibling = direction < 0
    ? blockCard.previousElementSibling
    : blockCard.nextElementSibling;

  if (!sibling) return;

  if (direction < 0) {
    blockCard.parentElement.insertBefore(blockCard, sibling);
  } else {
    blockCard.parentElement.insertBefore(sibling, blockCard);
  }

  refreshBlockAndExerciseNumbers();
  setOpenBlock(blockCard);
  markWorkoutFormDirty();
  closeBuilderMenu(blockCard);
}

function duplicateBlockCard(blockCard) {
  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));
  const sourceName = blockCard.querySelector(".block-name")?.value.trim() || "Block";
  const exerciseValues = Array.from(blockCard.querySelectorAll("[data-exercise-card]"))
    .map(readExerciseCardValues);

  blockCard.insertAdjacentHTML("afterend", createBlockCard(blockCards.length + 1));
  const duplicate = blockCard.nextElementSibling;
  duplicate.querySelector(".block-name").value = `${sourceName} Copy`;
  attachBlockEvents(duplicate);

  exerciseValues.forEach(exercise => addExerciseToBlock(duplicate, exercise));
  if (!exerciseValues.length) addExerciseToBlock(duplicate);

  refreshBlockAndExerciseNumbers();
  setOpenBlock(duplicate);
  markWorkoutFormDirty();
}

function createBlockCard(index) {
  // A block is a coach-facing group such as Warmup, A Block, or Finisher.
  const defaultName = getBlockDefaultName(index);
  const blockClientId = createClientId();

  return `
    <article class="workout-block-card" data-block-card data-block-client-id="${window.RipCityUI.attr(blockClientId)}">
      <div class="block-card-heading">
        <div class="block-heading-main">
          <button class="builder-drag-handle block-drag-handle" type="button" draggable="true" aria-label="Drag to reorder block" title="Drag to reorder block">⋮⋮</button>
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
        </div>

        <div class="block-actions">
          <button class="outline-btn" type="button" data-toggle-block>
            Collapse
          </button>
          <button class="primary-btn add-exercise-to-block-btn" type="button">
            Add Exercise
          </button>
          <details class="builder-more-menu">
            <summary aria-label="More block actions" title="More block actions">•••</summary>
            <div class="builder-more-menu-popover">
              <button type="button" data-duplicate-block>Duplicate Block</button>
              <button type="button" data-move-block-up>Move Block Up</button>
              <button type="button" data-move-block-down>Move Block Down</button>
              <button class="destructive-action" type="button" data-remove-block>Remove Block</button>
            </div>
          </details>
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
        <button class="builder-drag-handle exercise-drag-handle" type="button" draggable="true" aria-label="Drag to reorder exercise" title="Drag to reorder exercise">⋮⋮</button>
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
            <option value="band_color">Band + Reps</option>
            <option value="time">Time</option>
            <option value="distance">Distance</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <div class="exercise-row-actions">
          <label class="exercise-unilateral-toggle">
            <input type="checkbox" class="exercise-unilateral" />
            Each Side
          </label>
          <button class="outline-btn small-inline-btn toggle-exercise-details-btn" type="button">
            Details
          </button>
          <details class="builder-more-menu">
            <summary aria-label="More exercise actions" title="More exercise actions">•••</summary>
            <div class="builder-more-menu-popover">
              <button type="button" data-duplicate-exercise>Duplicate Exercise</button>
              <button type="button" data-move-exercise-up>Move Exercise Up</button>
              <button type="button" data-move-exercise-down>Move Exercise Down</button>
              <label>
                Move to Block
                <select data-move-exercise-block aria-label="Move exercise to another block"></select>
              </label>
              <button class="destructive-action" type="button" data-remove-exercise>Remove Exercise</button>
            </div>
          </details>
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
  // Renumber visible labels and disable order buttons at each boundary.
  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));

  blockCards.forEach((blockCard, blockIndex) => {
    const eyebrow = blockCard.querySelector(".eyebrow");
    if (eyebrow) eyebrow.textContent = `BLOCK ${blockIndex + 1}`;

    const moveBlockUp = blockCard.querySelector("[data-move-block-up]");
    const moveBlockDown = blockCard.querySelector("[data-move-block-down]");
    if (moveBlockUp) moveBlockUp.disabled = blockIndex === 0;
    if (moveBlockDown) moveBlockDown.disabled = blockIndex === blockCards.length - 1;

    const exerciseCards = Array.from(blockCard.querySelectorAll("[data-exercise-card]"));
    exerciseCards.forEach((exerciseCard, exerciseIndex) => {
      exerciseCard.querySelector("[data-exercise-row-label]").textContent = getExerciseRowLabel(exerciseIndex);
      const moveExerciseUp = exerciseCard.querySelector("[data-move-exercise-up]");
      const moveExerciseDown = exerciseCard.querySelector("[data-move-exercise-down]");
      if (moveExerciseUp) moveExerciseUp.disabled = exerciseIndex === 0;
      if (moveExerciseDown) moveExerciseDown.disabled = exerciseIndex === exerciseCards.length - 1;

      const blockSelect = exerciseCard.querySelector("[data-move-exercise-block]");
      if (blockSelect) {
        blockSelect.innerHTML = blockCards.map((targetBlock, targetIndex) => {
          const targetName = targetBlock.querySelector(".block-name")?.value.trim() || `Block ${targetIndex + 1}`;
          return `<option value="${window.RipCityUI.attr(targetBlock.dataset.blockClientId)}">${targetIndex + 1}. ${window.RipCityUI.text(targetName)}</option>`;
        }).join("");
        blockSelect.value = blockCard.dataset.blockClientId;
        blockSelect.disabled = blockCards.length < 2;
      }

      updateExerciseSummary(exerciseCard);
    });

    updateBlockSummary(blockCard);
  });

  updateWorkoutBuilderOutline();
}

function readExerciseCardValues(card) {
  return {
    exercise_template_id: getCardInputValue(card, ".exercise-template-id") || null,
    name: getCardInputValue(card, ".exercise-name"),
    description: getCardInputValue(card, ".exercise-description") || null,
    sets: getCardInputValue(card, ".exercise-sets") || null,
    reps: getCardInputValue(card, ".exercise-reps") || null,
    tempo: getCardInputValue(card, ".exercise-tempo") || null,
    rest_time: getCardInputValue(card, ".exercise-rest") || null,
    input_type: getCardInputValue(card, ".exercise-input-type") || "weight_reps",
    is_unilateral: Boolean(card.querySelector(".exercise-unilateral")?.checked),
    video_url: getCardInputValue(card, ".exercise-video") || null,
    coach_note: getCardInputValue(card, ".exercise-coach-note") || null
  };
}

function confirmExerciseRemoval(card) {
  const exercise = readExerciseCardValues(card);
  if (!exercise.name) return true;
  return window.confirm(`Remove ${exercise.name} from this workout?`);
}

function moveExerciseCard(card, direction) {
  const sibling = direction < 0
    ? card.previousElementSibling
    : card.nextElementSibling;

  if (!sibling) return;

  if (direction < 0) {
    card.parentElement.insertBefore(card, sibling);
  } else {
    card.parentElement.insertBefore(sibling, card);
  }

  refreshBlockAndExerciseNumbers();
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  markWorkoutFormDirty();
  closeBuilderMenu(card);
}

function moveExerciseToBlock(card, blockClientId) {
  const targetBlock = Array.from(document.querySelectorAll("[data-block-card]"))
    .find(blockCard => blockCard.dataset.blockClientId === blockClientId);
  if (!targetBlock || targetBlock.contains(card)) return;

  targetBlock.querySelector("[data-block-exercise-list]")?.append(card);
  refreshBlockAndExerciseNumbers();
  setOpenBlock(targetBlock);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  markWorkoutFormDirty();
  closeBuilderMenu(card);
}

function duplicateExerciseCard(card) {
  const blockCard = card.closest("[data-block-card]");
  if (!blockCard) return;

  const duplicate = addExerciseToBlock(blockCard, readExerciseCardValues(card), card);
  duplicate?.scrollIntoView({ behavior: "smooth", block: "center" });
  markWorkoutFormDirty();
}

function attachExerciseEvents(card) {
  attachBuilderDragEvents(card, "exercise");

  const templateSearch = card.querySelector(".exercise-template-search");
  const detailsButton = card.querySelector(".toggle-exercise-details-btn");

  renderExerciseTemplatePicker(templateSearch);

  templateSearch.addEventListener("input", () => {
    applyExerciseTemplateSearch(card);
  });

  templateSearch.addEventListener("change", () => {
    applyExerciseTemplateSearch(card);
    updateExerciseSummary(card);
  });

  card.querySelectorAll("input, select, textarea").forEach(input => {
    input.addEventListener("input", () => updateExerciseSummary(card));
    input.addEventListener("change", () => updateExerciseSummary(card));
  });

  card.querySelector(".exercise-input-type")?.addEventListener("change", () => {
    updateExerciseTargetField(card);
    updateExerciseSummary(card);
  });

  detailsButton.addEventListener("click", () => {
    const panel = card.querySelector("[data-exercise-details]");
    const hidden = panel.classList.toggle("hidden");
    detailsButton.textContent = hidden ? "Details" : "Hide Details";
  });

  card.querySelector("[data-remove-exercise]").addEventListener("click", () => {
    if (!confirmExerciseRemoval(card)) return;
    card.remove();
    refreshBlockAndExerciseNumbers();
    markWorkoutFormDirty();
  });

  card.querySelector("[data-move-exercise-up]").addEventListener("click", () => moveExerciseCard(card, -1));
  card.querySelector("[data-move-exercise-down]").addEventListener("click", () => moveExerciseCard(card, 1));
  card.querySelector("[data-duplicate-exercise]").addEventListener("click", () => {
    duplicateExerciseCard(card);
    closeBuilderMenu(card);
  });
  card.querySelector("[data-move-exercise-block]").addEventListener("change", event => {
    moveExerciseToBlock(card, event.currentTarget.value);
  });
}

function addExerciseToBlock(blockCard, exercise = null, insertAfter = null) {
  const list = blockCard.querySelector("[data-block-exercise-list]");
  const count = list.querySelectorAll("[data-exercise-card]").length + 1;

  if (insertAfter) {
    insertAfter.insertAdjacentHTML("afterend", createExerciseCard(count));
  } else {
    list.insertAdjacentHTML("beforeend", createExerciseCard(count));
  }

  const newestCard = insertAfter ? insertAfter.nextElementSibling : list.lastElementChild;
  attachExerciseEvents(newestCard);

  if (exercise) {
    setExerciseCardValues(newestCard, exercise);
  }

  updateExerciseSummary(newestCard);
  updateExerciseTargetField(newestCard);
  refreshBlockAndExerciseNumbers();

  return newestCard;
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
  card.querySelector(".exercise-unilateral").checked = Boolean(exercise.is_unilateral);
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
  markWorkoutFormDirty();
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
        is_unilateral: Boolean(card.querySelector(".exercise-unilateral")?.checked),
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

let workoutFormDirty = false;
let workoutSaveInProgress = false;

function getWorkoutBuilderReviewData() {
  const blocks = getBlockFormData();
  const exerciseCount = blocks.reduce((total, block) => total + block.exercises.length, 0);
  const targetType = getInputValue("workout-target-type") || "group";
  const groupIds = getSelectedValues("workout-group");
  const memberProfileId = getInputValue("workout-member");

  return {
    title: getInputValue("workout-title") || "Untitled workout",
    focus: getInputValue("workout-focus") || "No focus added",
    minutes: getInputValue("workout-minutes"),
    assignedDate: getInputValue("workout-date"),
    targetLabel: getTargetLabelForDraft(targetType, groupIds, memberProfileId),
    blocks,
    exerciseCount
  };
}

function updateWorkoutBuilderOutline() {
  const outline = document.getElementById("workout-builder-outline");
  if (!outline) return;

  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));
  if (!blockCards.length) {
    outline.innerHTML = `<div class="empty-state">Add a block to start the workout.</div>`;
    return;
  }

  outline.innerHTML = blockCards.map((blockCard, blockIndex) => {
    const blockName = blockCard.querySelector(".block-name")?.value.trim() || `Block ${blockIndex + 1}`;
    const exercises = Array.from(blockCard.querySelectorAll(".exercise-name"))
      .map((input, exerciseIndex) => input.value.trim() || `Exercise ${exerciseIndex + 1}`);

    return `
      <button class="workout-outline-block" type="button" data-outline-block="${window.RipCityUI.attr(blockCard.dataset.blockClientId)}">
        <span>${blockIndex + 1}</span>
        <span>
          <strong>${window.RipCityUI.text(blockName)}</strong>
          <small>${exercises.length} exercise${exercises.length === 1 ? "" : "s"}</small>
        </span>
      </button>
      <ol class="workout-outline-exercises">
        ${exercises.map(exercise => `<li>${window.RipCityUI.text(exercise)}</li>`).join("")}
      </ol>
    `;
  }).join("");

  outline.querySelectorAll("[data-outline-block]").forEach(button => {
    button.addEventListener("click", () => {
      const blockCard = blockCards.find(card => card.dataset.blockClientId === button.dataset.outlineBlock);
      if (!blockCard) return;
      setOpenBlock(blockCard);
      blockCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function updateWorkoutBuilderReview() {
  updateWorkoutDetailsSummary();
  updateWorkoutBuilderOutline();

  const review = document.getElementById("workout-builder-review");
  if (!review) return;

  const summary = getWorkoutBuilderReviewData();
  const scheduleLabel = summary.assignedDate
    ? `${summary.targetLabel} · ${formatDisplayDate(summary.assignedDate)}`
    : "No calendar date selected";

  review.innerHTML = `
    <div class="workout-builder-review-heading">
      <div>
        <span class="eyebrow">WORKOUT PREVIEW</span>
        <strong>${window.RipCityUI.text(summary.title)}</strong>
        <small>${window.RipCityUI.text(summary.focus)}</small>
      </div>
      <div class="workout-builder-review-stats">
        <span>${summary.blocks.length} block${summary.blocks.length === 1 ? "" : "s"}</span>
        <span>${summary.exerciseCount} exercise${summary.exerciseCount === 1 ? "" : "s"}</span>
        ${summary.minutes ? `<span>${window.RipCityUI.text(summary.minutes)} min</span>` : ""}
      </div>
    </div>
    <div class="workout-builder-review-blocks">
      ${summary.blocks.length ? summary.blocks.map(block => `
        <div>
          <strong>${window.RipCityUI.text(block.name)}</strong>
          <span>${window.RipCityUI.text(block.exercises.map(exercise => exercise.name).join(", "))}</span>
        </div>
      `).join("") : `<span class="muted-small">Add a named exercise to see the workout preview.</span>`}
    </div>
    <p>${window.RipCityUI.text(scheduleLabel)}</p>
  `;
}

function updateWorkoutDetailsSummary() {
  const summary = document.getElementById("workout-details-summary");
  if (!summary) return;

  const title = getInputValue("workout-title");
  const focus = getInputValue("workout-focus");
  const minutes = getInputValue("workout-minutes");

  if (!title) {
    summary.textContent = "Add a title to begin.";
    return;
  }

  summary.textContent = [title, focus, minutes ? `${minutes} min` : ""]
    .filter(Boolean)
    .join(" · ");
}

function setWorkoutDetailsCollapsed(shouldCollapse) {
  const step = document.getElementById("workout-details-step");
  const toggleButton = document.getElementById("toggle-workout-details-btn");
  if (!step || !toggleButton) return;

  step.classList.toggle("is-collapsed", shouldCollapse);
  toggleButton.setAttribute("aria-expanded", String(!shouldCollapse));
  toggleButton.textContent = shouldCollapse ? "Edit Details" : "Collapse";
}

function continueToWorkoutBuilder() {
  const titleInput = document.getElementById("workout-title");
  const title = titleInput?.value.trim() || "";

  if (!title) {
    showWorkoutValidationError("Add a workout title before continuing.", titleInput);
    return;
  }

  titleInput.removeAttribute("aria-invalid");
  showWorkoutMessage("");
  setWorkoutDetailsCollapsed(true);
  document.getElementById("workout-blocks-step")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function markWorkoutFormDirty() {
  workoutFormDirty = true;
  updateWorkoutBuilderReview();
}

function markWorkoutFormClean() {
  workoutFormDirty = false;
  updateWorkoutBuilderReview();
}

function initializeWorkoutBuilderTracking() {
  const form = document.getElementById("workout-form");
  if (!form) return;

  const handleFormChange = () => markWorkoutFormDirty();
  form.addEventListener("input", handleFormChange);
  form.addEventListener("change", handleFormChange);
  form.addEventListener("click", event => {
    if (event.target.closest("#add-block-btn, .add-exercise-to-block-btn")) {
      window.setTimeout(markWorkoutFormDirty, 0);
    }
  });

  document.getElementById("continue-to-workout-btn")?.addEventListener("click", continueToWorkoutBuilder);
  document.getElementById("toggle-workout-details-btn")?.addEventListener("click", () => {
    const step = document.getElementById("workout-details-step");
    if (step?.classList.contains("is-collapsed")) {
      setWorkoutDetailsCollapsed(false);
      document.getElementById("workout-title")?.focus();
      return;
    }

    continueToWorkoutBuilder();
  });

  window.addEventListener("beforeunload", event => {
    if (!workoutFormDirty || workoutSaveInProgress) return;
    event.preventDefault();
    event.returnValue = "";
  });

  updateWorkoutBuilderReview();
}
