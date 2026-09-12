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
