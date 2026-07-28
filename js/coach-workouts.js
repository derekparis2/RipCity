// =====================================================
// COACH WORKOUT BUILDER
// =====================================================
// Coaches can create a workout, add exercises,
// and assign that workout to a group for a specific date.

let workoutCoachAccess = null;
let availableGroups = [];
let availableMembers = [];
let availableGroupMemberships = [];
let exerciseTemplates = [];
let exerciseLibraryAvailable = false;
let recentWorkoutRows = [];

// ----------------------------
// Small helper functions
// ----------------------------

function showWorkoutMessage(message, isError = false) {
  const element = document.getElementById("coach-workouts-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function getInputValue(id) {
  const element = document.getElementById(id);
  if (!element) return "";
  return element.value.trim();
}

function getSelectedValues(id) {
  const element = document.getElementById(id);
  if (!element) return [];

  return Array.from(element.selectedOptions)
    .map(option => option.value)
    .filter(Boolean);
}

function getCardInputValue(card, selector) {
  const element = card.querySelector(selector);
  return element ? element.value.trim() : "";
}

function createClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback for older browsers. Supabase/Postgres still validates this as UUID.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, char => (
    Number(char) ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4
  ).toString(16));
}

function formatLocalDate(date) {
  // Date inputs should default to the coach's local calendar day.
  // toISOString() can jump to tomorrow for evening sessions.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setTodayAsDefaultDate() {
  const dateInput = document.getElementById("workout-date");
  if (!dateInput) return;

  dateInput.value = formatLocalDate(new Date());
}

function setFieldValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  element.value = value ?? "";
}

// ----------------------------
// Auth / access protection
// ----------------------------

async function getCurrentSession() {
  return window.RipCityAccess.getSession();
}

async function getCurrentUserProfile(userId) {
  return window.RipCityAccess.getProfileWithMemberships(userId);
}

async function requireCoachOrAdmin() {
  return window.RipCityAccess.requireCoachAccess({
    onDeniedMessage: showWorkoutMessage
  });
}

// ----------------------------
// Load groups
// ----------------------------

async function loadGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("*")
    .eq("facility_id", facilityId)
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function loadAssignableMembers(facilityId) {
  const { data, error } = await db
    .from("facility_members")
    .select(`
      id,
      role,
      profile:profiles!facility_members_profile_id_fkey (
        id,
        full_name,
        email
      ),
      member_profile:member_profiles (
        id,
        member_type,
        sport,
        age_group
      )
    `)
    .eq("facility_id", facilityId)
    .eq("status", "approved")
    .in("role", ["athlete", "h2k_member"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(member => {
    const memberProfile = window.RipCityWorkoutData
      ? window.RipCityWorkoutData.normalizeJoinedOne(member.member_profile)
      : Array.isArray(member.member_profile)
        ? member.member_profile[0]
        : member.member_profile;

    return {
      facilityMemberId: member.id,
      memberProfileId: memberProfile?.id,
      memberType: memberProfile?.member_type || member.role,
      sport: memberProfile?.sport || "",
      ageGroup: memberProfile?.age_group || "",
      name: member.profile?.full_name || "Unnamed Member",
      email: member.profile?.email || ""
    };
  }).filter(member => member.memberProfileId);
}

async function loadAssignableGroupMemberships(memberProfileIds) {
  if (!memberProfileIds.length) return [];

  const { data, error } = await db
    .from("group_members")
    .select("group_id, member_profile_id")
    .in("member_profile_id", memberProfileIds);

  if (error) throw error;

  return data || [];
}

function getAudienceFilter() {
  return getInputValue("workout-audience-filter") || "all";
}

function groupMatchesAudience(group, audience) {
  return audience === "all" ||
    group.member_type === "both" ||
    group.member_type === audience;
}

function memberMatchesAudience(member, audience) {
  return audience === "all" || member.memberType === audience;
}

function getFilteredGroups() {
  const audience = getAudienceFilter();
  return availableGroups.filter(group => groupMatchesAudience(group, audience));
}

function getFilteredMembers() {
  const audience = getAudienceFilter();
  return availableMembers.filter(member => memberMatchesAudience(member, audience));
}

function getMemberGroupNames(memberProfileId) {
  const groupIds = new Set(
    availableGroupMemberships
      .filter(row => row.member_profile_id === memberProfileId)
      .map(row => row.group_id)
  );

  return availableGroups
    .filter(group => groupIds.has(group.id))
    .map(group => group.name);
}

function updateAssignmentContext() {
  const element = document.getElementById("assignment-context");
  if (!element) return;

  const targetType = getInputValue("workout-target-type") || "group";
  const groups = getFilteredGroups();
  const members = getFilteredMembers();
  const audience = getAudienceFilter();

  const audienceLabel = audience === "all"
    ? "all approved members"
    : audience === "h2k"
      ? "H2K members"
      : "athletes";

  if (targetType === "facility") {
    element.textContent = `Facility assignment will reach ${members.length} ${audienceLabel}.`;
    return;
  }

  if (targetType === "member") {
    element.textContent = `${members.length} ${audienceLabel} available for individual assignment.`;
    return;
  }

  element.textContent = `${groups.length} compatible groups available for ${audienceLabel}.`;
}

function renderGroupOptions() {
  const select = document.getElementById("workout-group");
  const groups = getFilteredGroups();

  if (!groups.length) {
    select.innerHTML = `<option value="" disabled>No compatible groups found</option>`;
    updateAssignmentContext();
    return;
  }

  select.innerHTML = `
    ${groups.map(group => `
      <option value="${window.RipCityUI.attr(group.id)}">
        ${window.RipCityUI.text(group.name)} · ${window.RipCityUI.text(group.member_type)}
      </option>
    `).join("")}
  `;

  updateAssignmentContext();
}

function renderMemberOptions() {
  const select = document.getElementById("workout-member");
  if (!select) return;

  const members = getFilteredMembers();

  if (!members.length) {
    select.innerHTML = `<option value="">No compatible approved members found</option>`;
    updateAssignmentContext();
    return;
  }

  select.innerHTML = `
    <option value="">Select member...</option>
    ${members.map(member => {
      const groupNames = getMemberGroupNames(member.memberProfileId);
      const groupLabel = groupNames.length ? ` · ${groupNames.join(", ")}` : " · No group";

      return `
      <option value="${window.RipCityUI.attr(member.memberProfileId)}">
        ${window.RipCityUI.text(member.name)} · ${window.RipCityUI.text(member.memberType)}${member.sport ? ` · ${window.RipCityUI.text(member.sport)}` : ""}${window.RipCityUI.text(groupLabel)}
      </option>
    `;
    }).join("")}
  `;

  updateAssignmentContext();
}

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

  const list = input.closest(".exercise-library-picker")?.querySelector("datalist");

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

  if (categories.includes(currentValue)) {
    categoryFilter.value = currentValue;
  } else {
    categoryFilter.value = "all";
  }
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
    : filteredTemplates.slice(0, 8);

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
        Add to Builder
      </button>

      <button
        class="outline-btn small-inline-btn"
        type="button"
        data-toggle-template-edit="${window.RipCityUI.attr(template.id)}"
      >
        Edit Exercise
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

function renderAllGroupOptions() {
  return availableGroups.map(group => `
    <option value="${window.RipCityUI.attr(group.id)}">
      ${window.RipCityUI.text(group.name)} · ${window.RipCityUI.text(group.member_type)}
    </option>
  `).join("");
}

function renderAllMemberOptions() {
  return availableMembers.map(member => {
    const groupNames = getMemberGroupNames(member.memberProfileId);
    const groupLabel = groupNames.length ? ` · ${groupNames.join(", ")}` : " · No group";

    return `
      <option value="${window.RipCityUI.attr(member.memberProfileId)}">
        ${window.RipCityUI.text(member.name)} · ${window.RipCityUI.text(member.memberType)}${member.sport ? ` · ${window.RipCityUI.text(member.sport)}` : ""}${window.RipCityUI.text(groupLabel)}
      </option>
    `;
  }).join("");
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

function updateAssignmentControls() {
  const targetType = getInputValue("workout-target-type") || "group";
  const groupField = document.getElementById("workout-group-field");
  const memberField = document.getElementById("workout-member-field");
  const groupSelect = document.getElementById("workout-group");
  const memberSelect = document.getElementById("workout-member");

  groupField?.classList.toggle("hidden", targetType !== "group");
  memberField?.classList.toggle("hidden", targetType !== "member");

  if (groupSelect) {
    const isGroupTarget = targetType === "group";
    groupSelect.required = isGroupTarget;
    groupSelect.disabled = !isGroupTarget;

    if (!isGroupTarget) {
      Array.from(groupSelect.options).forEach(option => {
        option.selected = false;
      });
    }
  }

  if (memberSelect) {
    const isMemberTarget = targetType === "member";
    memberSelect.required = isMemberTarget;
    memberSelect.disabled = !isMemberTarget;

    if (!isMemberTarget) {
      memberSelect.value = "";
    }
  }

  updateAssignmentContext();
}

function refreshAssignmentOptions() {
  renderGroupOptions();
  renderMemberOptions();
  updateAssignmentControls();
}

// ----------------------------
// Block / Exercise form UI
// ----------------------------

function createBlockCard(index) {
  // A block is a coach-facing group such as Warmup, A Block, or Finisher.
  return `
    <article class="workout-block-card" data-block-card>
      <div class="block-card-heading">
        <div>
          <p class="eyebrow">BLOCK ${index}</p>
          <input
            type="text"
            class="block-name"
            value="${index === 1 ? "Warmup" : `Block ${index}`}"
            placeholder="Warmup, A Block, B Block, Finisher..."
            required
          />
        </div>

        <div class="block-actions">
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

  return `
    <article class="exercise-builder-card" data-exercise-card>
      <div class="exercise-card-heading">
        <h4>Exercise ${index}</h4>
        <button class="outline-btn remove-exercise-btn" type="button">Remove</button>
      </div>

      <input type="hidden" class="exercise-template-id" />

      <div class="exercise-library-picker">
        <label>
          Exercise Library
          <input
            type="text"
            class="exercise-template-search"
            list="${window.RipCityUI.attr(templateListId)}"
            placeholder="Loading library..."
            autocomplete="off"
          />
          <datalist id="${window.RipCityUI.attr(templateListId)}"></datalist>
          <small class="field-help">Type to search, or keep typing to use a custom exercise.</small>
        </label>
      </div>

      <label>
        Exercise Name
        <input type="text" class="exercise-name" placeholder="Trap Bar Deadlift" required />
      </label>

      <label>
        Description / Details
        <textarea class="exercise-description" rows="2" placeholder="Coaching cues, setup, or notes..."></textarea>
      </label>

      <div class="form-row">
        <label>
          Sets
          <input type="number" class="exercise-sets" placeholder="3" />
        </label>

        <label>
          Reps
          <input type="text" class="exercise-reps" placeholder="5, 8 each side, 30 sec..." />
        </label>
      </div>

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
          Input Type
          <select class="exercise-input-type">
            <option value="completion">Completion</option>
            <option value="weight_reps">Weight + Reps</option>
            <option value="band_color">Band Color</option>
            <option value="time">Time</option>
            <option value="distance">Distance</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          Video URL
          <input type="text" class="exercise-video" placeholder="Optional demo link" />
        </label>
      </div>

      <label>
        Coach Note
        <input type="text" class="exercise-coach-note" placeholder="Optional note for members" />
      </label>
    </article>
  `;
}

function refreshBlockAndExerciseNumbers() {
  // Renumber visible labels after deleting blocks/exercises.
  document.querySelectorAll("[data-block-card]").forEach((blockCard, blockIndex) => {
    const eyebrow = blockCard.querySelector(".eyebrow");
    if (eyebrow) eyebrow.textContent = `BLOCK ${blockIndex + 1}`;

    blockCard.querySelectorAll("[data-exercise-card]").forEach((exerciseCard, exerciseIndex) => {
      const heading = exerciseCard.querySelector("h4");
      if (heading) heading.textContent = `Exercise ${exerciseIndex + 1}`;
    });
  });
}

function addExerciseToBlock(blockCard) {
  const list = blockCard.querySelector("[data-block-exercise-list]");
  const count = list.querySelectorAll("[data-exercise-card]").length + 1;

  list.insertAdjacentHTML("beforeend", createExerciseCard(count));

  const newestCard = list.lastElementChild;
  const removeButton = newestCard.querySelector(".remove-exercise-btn");
  const templateSearch = newestCard.querySelector(".exercise-template-search");

  renderExerciseTemplatePicker(templateSearch);

  templateSearch.addEventListener("input", () => {
    applyExerciseTemplateSearch(newestCard);
  });

  templateSearch.addEventListener("change", () => {
    applyExerciseTemplateSearch(newestCard);
  });

  removeButton.addEventListener("click", () => {
    newestCard.remove();
    refreshBlockAndExerciseNumbers();
  });
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
  card.querySelector(".exercise-input-type").value = exercise.input_type || "completion";
  card.querySelector(".exercise-video").value = exercise.video_url || "";
  card.querySelector(".exercise-coach-note").value = exercise.coach_note || "";
}

function addBlockCard() {
  const list = document.getElementById("block-list");
  const count = document.querySelectorAll("[data-block-card]").length + 1;

  list.insertAdjacentHTML("beforeend", createBlockCard(count));

  const newestBlock = list.lastElementChild;

  newestBlock
    .querySelector(".add-exercise-to-block-btn")
    .addEventListener("click", () => addExerciseToBlock(newestBlock));

  newestBlock
    .querySelector(".remove-block-btn")
    .addEventListener("click", () => {
      newestBlock.remove();
      refreshBlockAndExerciseNumbers();
    });

  // Start every new block with one exercise so the coach can type immediately.
  addExerciseToBlock(newestBlock);
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

    blockCard
      .querySelector(".add-exercise-to-block-btn")
      .addEventListener("click", () => addExerciseToBlock(blockCard));

    blockCard
      .querySelector(".remove-block-btn")
      .addEventListener("click", () => {
        blockCard.remove();
        refreshBlockAndExerciseNumbers();
      });

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
  });

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

function buildAssignmentRows({ workoutId, targetType, groupIds = [], memberProfileId = "", assignedDate }) {
  const baseRow = {
    workout_id: workoutId,
    assigned_by: workoutCoachAccess.profile.id,
    assigned_date: assignedDate
  };

  if (targetType === "facility") {
    return [{
      ...baseRow,
      target_type: "facility",
      target_facility_id: workoutCoachAccess.membership.facility_id,
      target_group_id: null,
      target_member_profile_id: null
    }];
  }

  if (targetType === "member") {
    return [{
      ...baseRow,
      target_type: "member",
      target_facility_id: null,
      target_group_id: null,
      target_member_profile_id: memberProfileId
    }];
  }

  return groupIds.map(groupId => ({
    ...baseRow,
    target_type: "group",
    target_facility_id: null,
    target_group_id: groupId,
    target_member_profile_id: null
  }));
}

function getAssignmentKey(assignment) {
  return [
    assignment.assigned_date,
    assignment.target_type,
    assignment.target_facility_id || "",
    assignment.target_group_id || "",
    assignment.target_member_profile_id || ""
  ].join("|");
}

function filterDuplicateAssignmentRows(rows, existingAssignments = []) {
  const existingKeys = new Set(existingAssignments.map(getAssignmentKey));
  return rows.filter(row => !existingKeys.has(getAssignmentKey(row)));
}

function buildRecentWorkoutSelect(includeExerciseTemplateColumn = true) {
  const exerciseTemplateColumn = includeExerciseTemplateColumn
    ? "exercise_template_id,"
    : "";

  return `
    id,
    title,
    focus,
    description,
    estimated_minutes,
    created_at,
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
          rest_time,
          input_type,
          video_url,
          coach_note,
          ${exerciseTemplateColumn}
          exercise_order
      )
    ),
    workout_assignments (
      id,
      assigned_date,
      target_type,
      target_facility_id,
      target_group_id,
      target_member_profile_id
    )
  `;
}

function isMissingExerciseTemplateColumnError(error) {
  return /exercise_template_id/i.test(error?.message || "") ||
    /exercise_template_id/i.test(error?.details || "");
}

async function fetchRecentWorkoutRows(includeExerciseTemplateColumn = true) {
  return db
    .from("workouts")
    .select(buildRecentWorkoutSelect(includeExerciseTemplateColumn))
    .eq("facility_id", workoutCoachAccess.membership.facility_id)
    .order("created_at", { ascending: false })
    .limit(8);
}

// ----------------------------
// Save workout
// ----------------------------

async function createWorkoutWithAssignment(event) {
  event.preventDefault();
  updateAssignmentControls();

  showWorkoutMessage("Creating workout...");

  try {
    const title = getInputValue("workout-title");
    const focus = getInputValue("workout-focus");
    const description = getInputValue("workout-description");
    const minutes = getInputValue("workout-minutes");
    const targetType = getInputValue("workout-target-type") || "group";
    const groupIds = getSelectedValues("workout-group");
    const memberProfileId = getInputValue("workout-member");
    const assignedDate = getInputValue("workout-date");

    if (!title || !assignedDate) {
      showWorkoutMessage("Workout title and assigned date are required.", true);
      return;
    }

    if (targetType === "group" && !groupIds.length) {
      showWorkoutMessage("Choose at least one group for this assignment.", true);
      return;
    }

    if (targetType === "member" && !memberProfileId) {
      showWorkoutMessage("Choose a member for this assignment.", true);
      return;
    }

    const blocks = await ensureWorkoutExercisesAreInLibrary(getBlockFormData());

    if (!blocks.length) {
        showWorkoutMessage("Add at least one block with at least one exercise.", true);
        return;
    }

    const workoutId = createClientId();

    // Save order matters: workout -> blocks -> exercises -> assignment.
    // This preserves the relationships expected by member-dashboard/workout-session.
    // IDs are generated client-side so the flow does not rely on INSERT ... RETURNING,
    // which is more fragile under strict RLS policies.
    const { error: workoutError } = await db
      .from("workouts")
      .insert({
        id: workoutId,
        facility_id: workoutCoachAccess.membership.facility_id,
        title,
        focus: focus || null,
        description: description || null,
        estimated_minutes: minutes ? Number(minutes) : null,
        created_by: workoutCoachAccess.profile.id
      });

    if (workoutError) throw workoutError;

    const blockRows = blocks.map(block => ({
        id: createClientId(),
        workout_id: workoutId,
        name: block.name,
        block_order: block.block_order
    }));
    
    const { error: blockError } = await db
        .from("workout_blocks")
        .insert(blockRows);
    
    if (blockError) throw blockError;
    
    const exerciseRows = [];
    
    blocks.forEach(originalBlock => {
        const createdBlock = blockRows.find(
        block => block.block_order === originalBlock.block_order
        );
    
        originalBlock.exercises.forEach(exercise => {
        const exerciseRow = {
            workout_id: workoutId,
            block_id: createdBlock.id,
            name: exercise.name,
            description: exercise.description,
            sets: exercise.sets,
            reps: exercise.reps,
            tempo: exercise.tempo,
            rest_time: exercise.rest_time,
            input_type: exercise.input_type,
            video_url: exercise.video_url,
            coach_note: exercise.coach_note,
            exercise_order: exercise.exercise_order
        };

        if (exercise.exercise_template_id && exerciseLibraryAvailable) {
            exerciseRow.exercise_template_id = exercise.exercise_template_id;
        }

        exerciseRows.push(exerciseRow);
        });
    });
    
    const { error: exerciseError } = await db
        .from("workout_exercises")
        .insert(exerciseRows);
    
    if (exerciseError) throw exerciseError;

    const assignmentRows = buildAssignmentRows({
      workoutId,
      targetType,
      groupIds,
      memberProfileId,
      assignedDate
    });

    const { error: assignmentError } = await db
      .from("workout_assignments")
      .insert(assignmentRows);

    if (assignmentError) throw assignmentError;

    showWorkoutMessage("Workout created and assigned.");

    resetWorkoutForm();
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not create workout.", true);
  }
}

function resetWorkoutForm() {
    document.getElementById("workout-form").reset();
    document.getElementById("block-list").innerHTML = "";
    setTodayAsDefaultDate();
    updateAssignmentControls();
  
    // Start with common training blocks.
    addBlockCard();
}

// ----------------------------
// Recent workouts
// ----------------------------

async function loadRecentWorkouts() {
  const list = document.getElementById("recent-workouts-list");

  list.innerHTML = `<div class="empty-state">Loading workouts...</div>`;

  let { data, error } = await fetchRecentWorkoutRows(true);

  if (error && isMissingExerciseTemplateColumnError(error)) {
    ({ data, error } = await fetchRecentWorkoutRows(false));
  }

  if (error) {
    console.error(error);
    recentWorkoutRows = [];
    renderRecentWorkouts();
    list.innerHTML = `<div class="empty-state">Could not load workouts.</div>`;
    return;
  }

  recentWorkoutRows = data || [];
  renderRecentWorkouts();
}

function getRecentWorkoutFilters() {
  return {
    search: getInputValue("recent-workout-search").toLowerCase(),
    assignedDate: getInputValue("recent-workout-date-filter"),
    targetType: getInputValue("recent-workout-target-filter") || "all"
  };
}

function workoutMatchesRecentFilters(workout, filters) {
  const assignments = workout.workout_assignments || [];
  const targetLabels = assignments.map(getAssignmentTargetLabel);
  const searchableText = [
    workout.title,
    workout.focus,
    workout.description,
    ...targetLabels,
    ...(workout.workout_blocks || []).map(block => block.name),
    ...(workout.workout_blocks || []).flatMap(block =>
      (block.workout_exercises || []).map(exercise => exercise.name)
    )
  ].filter(Boolean).join(" ").toLowerCase();

  if (filters.search && !searchableText.includes(filters.search)) return false;

  if (filters.assignedDate && !assignments.some(row => row.assigned_date === filters.assignedDate)) {
    return false;
  }

  if (filters.targetType === "unassigned") {
    return assignments.length === 0;
  }

  if (filters.targetType !== "all" && !assignments.some(row => row.target_type === filters.targetType)) {
    return false;
  }

  return true;
}

function renderRecentWorkouts() {
  const list = document.getElementById("recent-workouts-list");
  const count = document.getElementById("recent-workouts-count");
  if (!list) return;

  if (!recentWorkoutRows.length) {
    if (count) count.textContent = "No workouts yet";
    list.innerHTML = `<div class="empty-state">No workouts created yet.</div>`;
    return;
  }

  const filters = getRecentWorkoutFilters();
  const filteredWorkouts = recentWorkoutRows.filter(workout =>
    workoutMatchesRecentFilters(workout, filters)
  );

  if (count) {
    count.textContent = `${filteredWorkouts.length} of ${recentWorkoutRows.length} shown`;
  }

  if (!filteredWorkouts.length) {
    list.innerHTML = `<div class="empty-state">No created workouts match those filters.</div>`;
    return;
  }

  list.innerHTML = filteredWorkouts.map(workout => {
    const assignments = workout.workout_assignments || [];
    const targetLabels = assignments.map(getAssignmentTargetLabel);
    const targetLabel = targetLabels.length
      ? [...new Set(targetLabels)].join(", ")
      : "Unassigned";
    const assignedDate = assignments[0]?.assigned_date || "No date";

    const blocks = [...(workout.workout_blocks || [])]
        .sort((a, b) => a.block_order - b.block_order);

    return `
      <article class="recent-workout-card">
        <div>
          <p class="eyebrow">${window.RipCityUI.text(workout.focus, "Workout")}</p>
          <h4>${window.RipCityUI.text(workout.title)}</h4>
          <p>${window.RipCityUI.text(workout.description, "No description added.")}</p>
        </div>

        <div class="workout-meta-row">
          <span>${workout.estimated_minutes || "—"} min</span>
          <span>${window.RipCityUI.text(targetLabel)}</span>
          <span>${window.RipCityUI.text(assignedDate)}</span>
        </div>

        <div class="recent-workout-actions">
          <button class="outline-btn small-inline-btn" type="button" data-load-workout-template="${window.RipCityUI.attr(workout.id)}">
            Load in Builder
          </button>
          <button class="outline-btn small-inline-btn" type="button" data-toggle-workout-edit="${window.RipCityUI.attr(workout.id)}">
            Edit Details
          </button>
        </div>

        <form class="recent-workout-edit-form hidden" data-workout-edit-form="${window.RipCityUI.attr(workout.id)}">
          <label>
            Title
            <input type="text" value="${window.RipCityUI.attr(workout.title || "")}" data-edit-workout-title required />
          </label>
          <div class="form-row">
            <label>
              Focus
              <input type="text" value="${window.RipCityUI.attr(workout.focus || "")}" data-edit-workout-focus />
            </label>
            <label>
              Estimated Minutes
              <input type="number" value="${window.RipCityUI.attr(workout.estimated_minutes || "")}" data-edit-workout-minutes />
            </label>
          </div>
          <label>
            Description
            <textarea rows="2" data-edit-workout-description>${window.RipCityUI.text(workout.description || "")}</textarea>
          </label>
          <div class="recent-workout-actions">
            <button class="primary-btn small-inline-btn" type="submit">Save Details</button>
            <button class="outline-btn small-inline-btn" type="button" data-cancel-workout-edit="${window.RipCityUI.attr(workout.id)}">Cancel</button>
          </div>
        </form>

        <div class="recent-reassign-card">
          <div>
            <strong>Assign this workout again</strong>
            <span>Reuse the same blocks and exercises for another date, group, or athlete.</span>
          </div>

          <div class="recent-reassign-grid">
            <label>
              Assign To
              <select data-reuse-target-type="${window.RipCityUI.attr(workout.id)}">
                <option value="group">Groups</option>
                <option value="member">Individual Member</option>
                <option value="facility">Entire Facility</option>
              </select>
            </label>

            <label>
              Assigned Date
              <input type="date" value="${formatLocalDate(new Date())}" data-reuse-date="${window.RipCityUI.attr(workout.id)}" />
            </label>

            <label data-reuse-group-field="${window.RipCityUI.attr(workout.id)}">
              Groups
              <select multiple size="4" data-reuse-groups="${window.RipCityUI.attr(workout.id)}">
                ${renderAllGroupOptions()}
              </select>
            </label>

            <label class="hidden" data-reuse-member-field="${window.RipCityUI.attr(workout.id)}">
              Member
              <select data-reuse-member="${window.RipCityUI.attr(workout.id)}">
                <option value="">Select member...</option>
                ${renderAllMemberOptions()}
              </select>
            </label>
          </div>

          <button class="outline-btn full-btn" type="button" data-assign-existing-workout="${window.RipCityUI.attr(workout.id)}">
            Assign Existing Workout
          </button>
        </div>

        <div class="workout-block-preview">
            ${blocks.map(block => {
                const exercises = [...(block.workout_exercises || [])]
                .sort((a, b) => a.exercise_order - b.exercise_order);

                return `
                <div class="workout-block-preview-item">
                    <strong>${window.RipCityUI.text(block.name)}</strong>
                    <ul class="workout-exercise-preview">
                    ${exercises.map(exercise => `
                        <li>
                        ${window.RipCityUI.text(exercise.name)}
                        ${exercise.sets || exercise.reps ? `<span>${window.RipCityUI.text(exercise.sets || "")} x ${window.RipCityUI.text(exercise.reps || "")}</span>` : ""}
                        </li>
                    `).join("")}
                    </ul>
                </div>
                `;
            }).join("")}
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-reuse-target-type]").forEach(select => {
    select.addEventListener("change", () => updateRecentAssignmentControls(select.dataset.reuseTargetType));
    updateRecentAssignmentControls(select.dataset.reuseTargetType);
  });

  list.querySelectorAll("[data-assign-existing-workout]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.assignExistingWorkout);
      assignExistingWorkout(workout);
    });
  });

  list.querySelectorAll("[data-load-workout-template]").forEach(button => {
    button.addEventListener("click", () => {
      const workout = recentWorkoutRows.find(row => row.id === button.dataset.loadWorkoutTemplate);
      loadWorkoutIntoBuilder(workout);
    });
  });

  list.querySelectorAll("[data-toggle-workout-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-workout-edit-form="${button.dataset.toggleWorkoutEdit}"]`)
        ?.classList.toggle("hidden");
    });
  });

  list.querySelectorAll("[data-cancel-workout-edit]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector(`[data-workout-edit-form="${button.dataset.cancelWorkoutEdit}"]`)
        ?.classList.add("hidden");
    });
  });

  list.querySelectorAll("[data-workout-edit-form]").forEach(form => {
    form.addEventListener("submit", event => saveWorkoutDetails(event, form.dataset.workoutEditForm));
  });
}

async function saveWorkoutDetails(event, workoutId) {
  event.preventDefault();

  const form = event.currentTarget;
  const title = form.querySelector("[data-edit-workout-title]").value.trim();
  const minutes = form.querySelector("[data-edit-workout-minutes]").value;

  if (!title) {
    showWorkoutMessage("Workout title is required.", true);
    return;
  }

  showWorkoutMessage("Saving workout details...");

  try {
    const { error } = await db
      .from("workouts")
      .update({
        title,
        focus: form.querySelector("[data-edit-workout-focus]").value.trim() || null,
        description: form.querySelector("[data-edit-workout-description]").value.trim() || null,
        estimated_minutes: minutes ? Number(minutes) : null
      })
      .eq("id", workoutId)
      .eq("facility_id", workoutCoachAccess.membership.facility_id);

    if (error) throw error;

    showWorkoutMessage("Workout details saved.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not save workout details.", true);
  }
}

function updateRecentAssignmentControls(workoutId) {
  const targetType = document.querySelector(`[data-reuse-target-type="${workoutId}"]`)?.value || "group";
  const groupField = document.querySelector(`[data-reuse-group-field="${workoutId}"]`);
  const memberField = document.querySelector(`[data-reuse-member-field="${workoutId}"]`);
  const groupSelect = document.querySelector(`[data-reuse-groups="${workoutId}"]`);
  const memberSelect = document.querySelector(`[data-reuse-member="${workoutId}"]`);

  groupField?.classList.toggle("hidden", targetType !== "group");
  memberField?.classList.toggle("hidden", targetType !== "member");

  if (groupSelect) {
    groupSelect.disabled = targetType !== "group";
    if (targetType !== "group") {
      Array.from(groupSelect.options).forEach(option => {
        option.selected = false;
      });
    }
  }

  if (memberSelect) {
    memberSelect.disabled = targetType !== "member";
    if (targetType !== "member") {
      memberSelect.value = "";
    }
  }
}

async function assignExistingWorkout(workout) {
  if (!workout) return;

  const workoutId = workout.id;
  const targetType = document.querySelector(`[data-reuse-target-type="${workoutId}"]`)?.value || "group";
  const assignedDate = document.querySelector(`[data-reuse-date="${workoutId}"]`)?.value || "";
  const groupIds = Array.from(document.querySelector(`[data-reuse-groups="${workoutId}"]`)?.selectedOptions || [])
    .map(option => option.value)
    .filter(Boolean);
  const memberProfileId = document.querySelector(`[data-reuse-member="${workoutId}"]`)?.value || "";

  if (!assignedDate) {
    showWorkoutMessage("Choose an assigned date before reusing the workout.", true);
    return;
  }

  if (targetType === "group" && !groupIds.length) {
    showWorkoutMessage("Choose at least one group before reusing the workout.", true);
    return;
  }

  if (targetType === "member" && !memberProfileId) {
    showWorkoutMessage("Choose a member before reusing the workout.", true);
    return;
  }

  const assignmentRows = buildAssignmentRows({
    workoutId,
    targetType,
    groupIds,
    memberProfileId,
    assignedDate
  });
  const rowsToInsert = filterDuplicateAssignmentRows(assignmentRows, workout.workout_assignments || []);

  if (!rowsToInsert.length) {
    showWorkoutMessage("That workout is already assigned to the selected target for that date.", true);
    return;
  }

  showWorkoutMessage("Assigning existing workout...");

  try {
    const { error } = await db
      .from("workout_assignments")
      .insert(rowsToInsert);

    if (error) throw error;

    showWorkoutMessage("Existing workout assigned.");
    await loadRecentWorkouts();
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not assign existing workout.", true);
  }
}

function getAssignmentTargetLabel(assignment) {
  if (!assignment) return "Unassigned";

  if (assignment.target_type === "facility") {
    return "Entire Facility";
  }

  if (assignment.target_type === "member") {
    const member = availableMembers.find(row =>
      row.memberProfileId === assignment.target_member_profile_id
    );

    return member ? member.name : "Individual Member";
  }

  const group = availableGroups.find(g => g.id === assignment.target_group_id);
  return group?.name || "Group";
}

// ----------------------------
// Logout / init
// ----------------------------

async function logoutCoachWorkouts() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initCoachWorkoutsPage() {
  showWorkoutMessage("Checking access...");

  try {
    workoutCoachAccess = await requireCoachOrAdmin();

    if (!workoutCoachAccess) return;

    availableGroups = await loadGroups(workoutCoachAccess.membership.facility_id);
    availableMembers = await loadAssignableMembers(workoutCoachAccess.membership.facility_id);
    availableGroupMemberships = await loadAssignableGroupMemberships(
      availableMembers.map(member => member.memberProfileId)
    );
    refreshAssignmentOptions();
    await refreshExerciseLibrary();

    setTodayAsDefaultDate();
    addBlockCard();
    await loadRecentWorkouts();

    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load workout page.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachWorkoutsPage();

  document.getElementById("add-block-btn").addEventListener("click", addBlockCard);
  document.getElementById("exercise-library-form").addEventListener("submit", saveExerciseTemplate);
  document.getElementById("exercise-library-search")?.addEventListener("input", renderExerciseLibraryList);
  document.getElementById("exercise-library-category-filter")?.addEventListener("change", renderExerciseLibraryList);
  document.getElementById("exercise-library-input-filter")?.addEventListener("change", renderExerciseLibraryList);
  document.getElementById("recent-workout-search")?.addEventListener("input", renderRecentWorkouts);
  document.getElementById("recent-workout-date-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("recent-workout-target-filter")?.addEventListener("change", renderRecentWorkouts);
  document.getElementById("workout-audience-filter").addEventListener("change", refreshAssignmentOptions);
  document.getElementById("workout-target-type").addEventListener("change", updateAssignmentControls);
  document.getElementById("workout-form").addEventListener("submit", createWorkoutWithAssignment);
  document.getElementById("refresh-workouts-btn").addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-workouts-logout-btn").addEventListener("click", logoutCoachWorkouts);
});
