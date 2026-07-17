// =====================================================
// COACH WORKOUT BUILDER
// =====================================================
// Coaches can create a workout, add exercises,
// and assign that workout to a group for a specific date.

let workoutCoachAccess = null;
let availableGroups = [];
let availableMembers = [];
let exerciseTemplates = [];
let exerciseLibraryAvailable = false;

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

function renderGroupOptions() {
  const select = document.getElementById("workout-group");

  if (!availableGroups.length) {
    select.innerHTML = `<option value="">No groups found</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select group...</option>
    ${availableGroups.map(group => `
      <option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>
    `).join("")}
  `;
}

function renderMemberOptions() {
  const select = document.getElementById("workout-member");
  if (!select) return;

  if (!availableMembers.length) {
    select.innerHTML = `<option value="">No approved members found</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select member...</option>
    ${availableMembers.map(member => `
      <option value="${window.RipCityUI.attr(member.memberProfileId)}">
        ${window.RipCityUI.text(member.name)} · ${window.RipCityUI.text(member.memberType)}${member.sport ? ` · ${window.RipCityUI.text(member.sport)}` : ""}
      </option>
    `).join("")}
  `;
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

function renderExerciseTemplatePicker(select) {
  if (!select) return;

  if (!exerciseLibraryAvailable) {
    select.innerHTML = `<option value="">Library migration not run yet</option>`;
    select.disabled = true;
    return;
  }

  if (!exerciseTemplates.length) {
    select.innerHTML = `<option value="">No library exercises yet</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = `
    <option value="">Choose from library...</option>
    ${exerciseTemplates.map(template => `
      <option value="${window.RipCityUI.attr(template.id)}">
        ${window.RipCityUI.text(template.name)}${template.category ? ` · ${window.RipCityUI.text(template.category)}` : ""}
      </option>
    `).join("")}
  `;
}

function refreshExerciseTemplatePickers() {
  document.querySelectorAll(".exercise-template-select").forEach(select => {
    renderExerciseTemplatePicker(select);
  });
}

function renderExerciseLibraryList() {
  const list = document.getElementById("exercise-library-list");
  if (!list) return;

  if (!exerciseLibraryAvailable) {
    list.innerHTML = `
      <div class="empty-state">
        Exercise library tables are not installed yet. Coaches can keep typing exercises manually.
      </div>
    `;
    return;
  }

  if (!exerciseTemplates.length) {
    list.innerHTML = `<div class="empty-state">No library exercises yet. Save one above.</div>`;
    return;
  }

  list.innerHTML = exerciseTemplates.map(template => `
    <article class="exercise-library-card">
      <div>
        <h4>${window.RipCityUI.text(template.name)}</h4>
        <p>${window.RipCityUI.text(template.description, "No cues added.")}</p>
      </div>

      <div class="workout-meta-row">
        <span>${window.RipCityUI.text(template.input_type)}</span>
        ${template.category ? `<span>${window.RipCityUI.text(template.category)}</span>` : ""}
        ${template.equipment ? `<span>${window.RipCityUI.text(template.equipment)}</span>` : ""}
      </div>
    </article>
  `).join("");
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
  card.querySelector(".exercise-name").value = template.name || "";
  card.querySelector(".exercise-description").value = template.description || "";
  card.querySelector(".exercise-input-type").value = template.input_type || "completion";
  card.querySelector(".exercise-video").value = template.video_url || "";
  card.querySelector(".exercise-coach-note").value = template.coach_note || "";
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
        video_url: getInputValue("library-exercise-video") || null
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
      groupSelect.value = "";
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
          <select class="exercise-template-select">
            <option value="">Loading library...</option>
          </select>
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
  const templateSelect = newestCard.querySelector(".exercise-template-select");

  renderExerciseTemplatePicker(templateSelect);

  templateSelect.addEventListener("change", () => {
    applyExerciseTemplateToCard(newestCard, templateSelect.value);
  });

  removeButton.addEventListener("click", () => {
    newestCard.remove();
    refreshBlockAndExerciseNumbers();
  });
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

function getBlockFormData() {
  const blockCards = Array.from(document.querySelectorAll("[data-block-card]"));

  return blockCards.map((blockCard, blockIndex) => {
    const blockName = blockCard.querySelector(".block-name").value.trim();
    const exerciseCards = Array.from(blockCard.querySelectorAll("[data-exercise-card]"));

    const exercises = exerciseCards.map((card, exerciseIndex) => {
      return {
        name: card.querySelector(".exercise-name").value.trim(),
        description: card.querySelector(".exercise-description").value.trim() || null,
        sets: card.querySelector(".exercise-sets").value
          ? Number(card.querySelector(".exercise-sets").value)
          : null,
        reps: card.querySelector(".exercise-reps").value.trim() || null,
        tempo: card.querySelector(".exercise-tempo").value.trim() || null,
        rest_time: card.querySelector(".exercise-rest").value.trim() || null,
        input_type: card.querySelector(".exercise-input-type").value,
        exercise_template_id: getCardInputValue(card, ".exercise-template-id") || null,
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
    const groupId = getInputValue("workout-group");
    const memberProfileId = getInputValue("workout-member");
    const assignedDate = getInputValue("workout-date");

    if (!title || !assignedDate) {
      showWorkoutMessage("Workout title and assigned date are required.", true);
      return;
    }

    if (targetType === "group" && !groupId) {
      showWorkoutMessage("Choose a group for this assignment.", true);
      return;
    }

    if (targetType === "member" && !memberProfileId) {
      showWorkoutMessage("Choose a member for this assignment.", true);
      return;
    }

    const blocks = getBlockFormData();

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

    const assignmentRow = {
      workout_id: workoutId,
      assigned_by: workoutCoachAccess.profile.id,
      target_type: targetType,
      target_facility_id: targetType === "facility"
        ? workoutCoachAccess.membership.facility_id
        : null,
      target_group_id: targetType === "group" ? groupId : null,
      target_member_profile_id: targetType === "member" ? memberProfileId : null,
      assigned_date: assignedDate
    };

    const { error: assignmentError } = await db
      .from("workout_assignments")
      .insert(assignmentRow);

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

  const { data, error } = await db
    .from("workouts")
    .select(`
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
            sets,
            reps,
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
    `)
    .eq("facility_id", workoutCoachAccess.membership.facility_id)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error(error);
    list.innerHTML = `<div class="empty-state">Could not load workouts.</div>`;
    return;
  }

  if (!data.length) {
    list.innerHTML = `<div class="empty-state">No workouts created yet.</div>`;
    return;
  }

  list.innerHTML = data.map(workout => {
    const assignment = workout.workout_assignments?.[0];
    const targetLabel = getAssignmentTargetLabel(assignment);
    const assignedDate = assignment?.assigned_date || "No date";

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
    renderGroupOptions();
    renderMemberOptions();
    await refreshExerciseLibrary();

    setTodayAsDefaultDate();
    updateAssignmentControls();
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
  document.getElementById("workout-target-type").addEventListener("change", updateAssignmentControls);
  document.getElementById("workout-form").addEventListener("submit", createWorkoutWithAssignment);
  document.getElementById("refresh-workouts-btn").addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-workouts-logout-btn").addEventListener("click", logoutCoachWorkouts);
});
