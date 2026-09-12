// =====================================================
// COACH EXERCISE LIBRARY
// =====================================================
// Facility-scoped library loading and search helpers. Rendering and mutation
// actions will move here in the next behavior-preserving refactor slice.

function showExerciseLibraryMessage(message, isError = false) {
  const element = document.getElementById("exercise-library-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function isMissingExerciseLibraryError(error) {
  return error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /exercise_templates/i.test(error?.message || "");
}

async function loadExerciseTemplates(facilityId) {
  const { data, error } = await db
    .from("exercise_templates")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    if (isMissingExerciseLibraryError(error)) {
      exerciseLibraryAvailable = false;
      return [];
    }

    throw error;
  }

  exerciseLibraryAvailable = true;
  return data || [];
}

function getExerciseTemplateLabel(template) {
  return [
    template.category,
    template.equipment,
    template.input_type
  ].filter(Boolean).join(" · ");
}

function normalizeExerciseName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findExerciseTemplateByName(name) {
  const normalizedName = normalizeExerciseName(name);
  return exerciseTemplates.find(template => normalizeExerciseName(template.name) === normalizedName);
}

function renderExerciseTemplatePicker(input) {
  if (!input) return;

  const list = input.parentElement?.querySelector("datalist") ||
    input.closest("[data-exercise-card]")?.querySelector("datalist");

  if (!exerciseLibraryAvailable) {
    input.placeholder = "Library migration not run yet";
    input.disabled = true;
    if (list) list.innerHTML = "";
    return;
  }

  if (!exerciseTemplates.length) {
    input.placeholder = "No library exercises yet";
    input.disabled = true;
    if (list) list.innerHTML = "";
    return;
  }

  input.disabled = false;
  input.placeholder = "Start typing an exercise...";

  if (!list) return;

  list.innerHTML = `
    ${exerciseTemplates.map(template => `
      <option
        value="${window.RipCityUI.attr(template.name)}"
        label="${window.RipCityUI.attr(getExerciseTemplateLabel(template))}"
      ></option>
    `).join("")}
  `;
}

function refreshExerciseTemplatePickers() {
  document.querySelectorAll(".exercise-template-search").forEach(input => {
    renderExerciseTemplatePicker(input);
  });
}

function formatInputTypeLabel(inputType) {
  const labels = {
    completion: "Completion",
    weight_reps: "Weight + Reps",
    band_color: "Band Color",
    time: "Time",
    distance: "Distance",
    custom: "Custom"
  };

  return labels[inputType] || inputType || "Completion";
}

function getLibrarySearchFilters() {
  return {
    search: getInputValue("exercise-library-search").toLowerCase(),
    category: getInputValue("exercise-library-category-filter") || "all",
    inputType: getInputValue("exercise-library-input-filter") || "all"
  };
}

function renderExerciseLibraryFilters() {
  const categoryFilter = document.getElementById("exercise-library-category-filter");
  if (!categoryFilter) return;

  const currentValue = categoryFilter.value || "all";
  const categories = Array.from(new Set(
    exerciseTemplates
      .map(template => template.category)
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  categoryFilter.innerHTML = `
    <option value="all">All categories</option>
    ${categories.map(category => `
      <option value="${window.RipCityUI.attr(category)}">${window.RipCityUI.text(category)}</option>
    `).join("")}
  `;

  categoryFilter.value = categories.includes(currentValue) ? currentValue : "all";
}

function getFilteredExerciseTemplates() {
  const filters = getLibrarySearchFilters();

  return exerciseTemplates.filter(template => {
    const searchableText = [
      template.name,
      template.category,
      template.equipment,
      template.input_type,
      template.description,
      template.coach_note
    ].filter(Boolean).join(" ").toLowerCase();

    if (filters.search && !searchableText.includes(filters.search)) return false;
    if (filters.category !== "all" && template.category !== filters.category) return false;
    if (filters.inputType !== "all" && template.input_type !== filters.inputType) return false;

    return true;
  });
}

// ----------------------------
// Exercise library UI and persistence
// ----------------------------

function renderExerciseLibraryList() {
  const list = document.getElementById("exercise-library-list");
  const count = document.getElementById("exercise-library-count");
  if (!list) return;

  if (!exerciseLibraryAvailable) {
    if (count) count.textContent = "Exercise library migration not detected.";
    list.innerHTML = `
      <div class="empty-state">
        Exercise library tables are not installed yet. Coaches can keep typing exercises manually.
      </div>
    `;
    return;
  }

  if (!exerciseTemplates.length) {
    if (count) count.textContent = "No saved exercises yet.";
    list.innerHTML = `<div class="empty-state">No library exercises yet. Save one above.</div>`;
    return;
  }

  renderExerciseLibraryFilters();

  const filteredTemplates = getFilteredExerciseTemplates();
  const hasActiveSearch = Boolean(
    getInputValue("exercise-library-search") ||
    getInputValue("exercise-library-category-filter") !== "all" ||
    getInputValue("exercise-library-input-filter") !== "all"
  );
  const visibleTemplates = hasActiveSearch
    ? filteredTemplates
    : filteredTemplates.slice(0, 4);

  if (count) {
    count.textContent = hasActiveSearch
      ? `${filteredTemplates.length} of ${exerciseTemplates.length} exercises shown.`
      : `Showing ${visibleTemplates.length} recent exercises. Search or filter to edit the full library.`;
  }

  if (!filteredTemplates.length) {
    list.innerHTML = `<div class="empty-state">No exercises match that search.</div>`;
    return;
  }

  list.innerHTML = visibleTemplates.map(template => `
    <article class="exercise-library-card">
      <div>
        <h4>${window.RipCityUI.text(template.name)}</h4>
        <p>${window.RipCityUI.text(template.description, "No cues added.")}</p>
      </div>

      <div class="workout-meta-row">
        <span>${window.RipCityUI.text(formatInputTypeLabel(template.input_type))}</span>
        ${template.category ? `<span>${window.RipCityUI.text(template.category)}</span>` : ""}
        ${template.equipment ? `<span>${window.RipCityUI.text(template.equipment)}</span>` : ""}
      </div>

      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-add-template-to-builder="${window.RipCityUI.attr(template.id)}"
      >
        Add
      </button>

      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-toggle-template-edit="${window.RipCityUI.attr(template.id)}"
      >
        Edit
      </button>

      <form class="exercise-template-edit-form hidden" data-template-edit-form="${window.RipCityUI.attr(template.id)}">
        <label>
          Exercise Name
          <input type="text" value="${window.RipCityUI.attr(template.name || "")}" data-template-edit-name required />
        </label>

        <div class="form-row">
          <label>
            Category
            <input type="text" value="${window.RipCityUI.attr(template.category || "")}" data-template-edit-category />
          </label>

          <label>
            Equipment
            <input type="text" value="${window.RipCityUI.attr(template.equipment || "")}" data-template-edit-equipment />
          </label>
        </div>

        <label>
          Default Input Type
          <select data-template-edit-input-type>
            <option value="completion" ${template.input_type === "completion" ? "selected" : ""}>Completion</option>
            <option value="weight_reps" ${template.input_type === "weight_reps" ? "selected" : ""}>Weight + Reps</option>
            <option value="band_color" ${template.input_type === "band_color" ? "selected" : ""}>Band Color</option>
            <option value="time" ${template.input_type === "time" ? "selected" : ""}>Time</option>
            <option value="distance" ${template.input_type === "distance" ? "selected" : ""}>Distance</option>
            <option value="custom" ${template.input_type === "custom" ? "selected" : ""}>Custom</option>
          </select>
        </label>

        <label>
          Description / Cues
          <textarea rows="3" data-template-edit-description>${window.RipCityUI.text(template.description || "")}</textarea>
        </label>

        <label>
          Demo Video URL
          <input type="text" value="${window.RipCityUI.attr(template.video_url || "")}" data-template-edit-video />
        </label>

        <label>
          Default Coach Note
          <textarea rows="2" data-template-edit-coach-note>${window.RipCityUI.text(template.coach_note || "")}</textarea>
        </label>

        <div class="exercise-template-edit-actions">
          <button class="primary-btn small-inline-btn" type="submit">Save Exercise</button>
          <button class="outline-btn small-inline-btn" type="button" data-cancel-template-edit="${window.RipCityUI.attr(template.id)}">Cancel</button>
        </div>
      </form>
    </article>
  `).join("");

  list.querySelectorAll("[data-add-template-to-builder]").forEach(button => {
    button.addEventListener("click", () => addTemplateToBuilder(button.dataset.addTemplateToBuilder));
  });

  list.querySelectorAll("[data-toggle-template-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-template-edit-form="${button.dataset.toggleTemplateEdit}"]`)
        ?.classList.toggle("hidden");
    });
  });

  list.querySelectorAll("[data-cancel-template-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-template-edit-form="${button.dataset.cancelTemplateEdit}"]`)
        ?.classList.add("hidden");
    });
  });

  list.querySelectorAll("[data-template-edit-form]").forEach(form => {
    form.addEventListener("submit", event => saveExerciseTemplateEdit(event, form.dataset.templateEditForm));
  });
}

async function refreshExerciseLibrary() {
  showExerciseLibraryMessage("Loading exercise library...");

  try {
    exerciseTemplates = await loadExerciseTemplates(workoutCoachAccess.membership.facility_id);
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();

    showExerciseLibraryMessage(
      exerciseLibraryAvailable
        ? ""
        : "Run the exercise library migration to enable saved exercises."
    );
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not load exercise library.", true);
    exerciseLibraryAvailable = false;
    exerciseTemplates = [];
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();
  }
}

async function saveExerciseTemplate(event) {
  event.preventDefault();

  if (!exerciseLibraryAvailable) {
    showExerciseLibraryMessage("Run the exercise library migration before saving templates.", true);
    return;
  }

  const name = getInputValue("library-exercise-name");

  if (!name) {
    showExerciseLibraryMessage("Exercise name is required.", true);
    return;
  }

  showExerciseLibraryMessage("Saving exercise...");

  try {
    const { error } = await db
      .from("exercise_templates")
      .insert({
        facility_id: workoutCoachAccess.membership.facility_id,
        created_by: workoutCoachAccess.profile.id,
        name,
        category: getInputValue("library-exercise-category") || null,
        equipment: getInputValue("library-exercise-equipment") || null,
        input_type: getInputValue("library-exercise-input-type") || "completion",
        description: getInputValue("library-exercise-description") || null,
        video_url: getInputValue("library-exercise-video") || null,
        coach_note: getInputValue("library-exercise-coach-note") || null
      });

    if (error) throw error;

    document.getElementById("exercise-library-form").reset();
    await refreshExerciseLibrary();
    showExerciseLibraryMessage("Exercise saved.");
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not save exercise.", true);
  }
}

async function saveExerciseTemplateEdit(event, templateId) {
  event.preventDefault();

  const form = event.currentTarget;
  const name = form.querySelector("[data-template-edit-name]").value.trim();

  if (!name) {
    showExerciseLibraryMessage("Exercise name is required.", true);
    return;
  }

  showExerciseLibraryMessage("Saving exercise...");

  try {
    const { error } = await db
      .from("exercise_templates")
      .update({
        name,
        category: form.querySelector("[data-template-edit-category]").value.trim() || null,
        equipment: form.querySelector("[data-template-edit-equipment]").value.trim() || null,
        input_type: form.querySelector("[data-template-edit-input-type]").value || "completion",
        description: form.querySelector("[data-template-edit-description]").value.trim() || null,
        video_url: form.querySelector("[data-template-edit-video]").value.trim() || null,
        coach_note: form.querySelector("[data-template-edit-coach-note]").value.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", templateId)
      .eq("facility_id", workoutCoachAccess.membership.facility_id);

    if (error) throw error;

    await refreshExerciseLibrary();
    showExerciseLibraryMessage("Exercise updated.");
  } catch (error) {
    console.error(error);
    showExerciseLibraryMessage(error.message || "Could not update exercise.", true);
  }
}

async function createTemplateFromWorkoutExercise(exercise) {
  const templateId = createClientId();
  const { error } = await db
    .from("exercise_templates")
    .insert({
      id: templateId,
      facility_id: workoutCoachAccess.membership.facility_id,
      created_by: workoutCoachAccess.profile.id,
      name: exercise.name,
      input_type: exercise.input_type || "completion",
      description: exercise.description,
      video_url: exercise.video_url,
      coach_note: exercise.coach_note
    });

  if (error) throw error;

  return {
    id: templateId,
    facility_id: workoutCoachAccess.membership.facility_id,
    name: exercise.name,
    input_type: exercise.input_type || "completion",
    description: exercise.description,
    video_url: exercise.video_url,
    coach_note: exercise.coach_note
  };
}

async function ensureWorkoutExercisesAreInLibrary(blocks) {
  if (!exerciseLibraryAvailable) return blocks;

  // Before a workout is saved, attach every exercise to an existing template
  // or create a facility-owned template for custom coach entries. That keeps
  // the library useful without forcing coaches to leave the builder flow.
  const templatesByName = new Map(
    exerciseTemplates.map(template => [normalizeExerciseName(template.name), template])
  );
  const createdTemplates = [];

  for (const block of blocks) {
    for (const exercise of block.exercises) {
      if (exercise.exercise_template_id) continue;

      const normalizedName = normalizeExerciseName(exercise.name);
      if (!normalizedName) continue;

      const existingTemplate = templatesByName.get(normalizedName);
      if (existingTemplate) {
        exercise.exercise_template_id = existingTemplate.id;
        continue;
      }

      try {
        const createdTemplate = await createTemplateFromWorkoutExercise(exercise);
        templatesByName.set(normalizedName, createdTemplate);
        createdTemplates.push(createdTemplate);
        exercise.exercise_template_id = createdTemplate.id;
      } catch (error) {
        // If another coach added the same exercise first, refresh and attach it.
        // Other errors should still stop the workout save so the coach sees them.
        if (error?.code !== "23505") throw error;

        exerciseTemplates = await loadExerciseTemplates(workoutCoachAccess.membership.facility_id);
        const duplicateTemplate = findExerciseTemplateByName(exercise.name);
        if (!duplicateTemplate) throw error;

        templatesByName.set(normalizedName, duplicateTemplate);
        exercise.exercise_template_id = duplicateTemplate.id;
      }
    }
  }

  if (createdTemplates.length) {
    exerciseTemplates = [...exerciseTemplates, ...createdTemplates]
      .sort((a, b) => a.name.localeCompare(b.name));
    renderExerciseLibraryList();
    refreshExerciseTemplatePickers();
  }

  return blocks;
}
