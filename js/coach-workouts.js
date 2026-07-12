// =====================================================
// COACH WORKOUT BUILDER
// =====================================================
// Coaches can create a workout, add exercises,
// and assign that workout to a group for a specific date.

let workoutCoachAccess = null;
let availableGroups = [];

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

function setTodayAsDefaultDate() {
  const dateInput = document.getElementById("workout-date");
  if (!dateInput) return;

  dateInput.value = new Date().toISOString().split("T")[0];
}

// ----------------------------
// Auth / access protection
// ----------------------------

async function getCurrentSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  return data.session;
}

async function getCurrentUserProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      global_role,
      facility_members:facility_members!facility_members_profile_id_fkey (
        id,
        role,
        status,
        facility_id
      )
    `)
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

async function requireCoachOrAdmin() {
  const session = await getCurrentSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const profile = await getCurrentUserProfile(session.user.id);

  const membership =
    profile.facility_members?.[0] ||
    profile["facility_members!facility_members_profile_id_fkey"]?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  if (membership.role !== "coach" && membership.role !== "admin") {
    showWorkoutMessage("You do not have permission to view this page.", true);
    return null;
  }

  return {
    session,
    profile,
    membership
  };
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

function renderGroupOptions() {
  const select = document.getElementById("workout-group");

  if (!availableGroups.length) {
    select.innerHTML = `<option value="">No groups found</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select group...</option>
    ${availableGroups.map(group => `
      <option value="${group.id}">${group.name}</option>
    `).join("")}
  `;
}

// ----------------------------
// Block / Exercise form UI
// ----------------------------

function createBlockCard(index) {
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
    return `
      <article class="exercise-builder-card" data-exercise-card>
        <div class="exercise-card-heading">
          <h4>Exercise ${index}</h4>
          <button class="outline-btn remove-exercise-btn" type="button">Remove</button>
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
  
    // Start every new block with one exercise.
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

  showWorkoutMessage("Creating workout...");

  try {
    const title = getInputValue("workout-title");
    const focus = getInputValue("workout-focus");
    const description = getInputValue("workout-description");
    const minutes = getInputValue("workout-minutes");
    const groupId = getInputValue("workout-group");
    const assignedDate = getInputValue("workout-date");

    if (!title || !groupId || !assignedDate) {
      showWorkoutMessage("Workout title, group, and assigned date are required.", true);
      return;
    }

    const blocks = getBlockFormData();

    if (!blocks.length) {
        showWorkoutMessage("Add at least one block with at least one exercise.", true);
        return;
    }

    // 1. Create the workout.
    const { data: workout, error: workoutError } = await db
      .from("workouts")
      .insert({
        facility_id: workoutCoachAccess.membership.facility_id,
        title,
        focus: focus || null,
        description: description || null,
        estimated_minutes: minutes ? Number(minutes) : null,
        created_by: workoutCoachAccess.profile.id
      })
      .select()
      .single();

    if (workoutError) throw workoutError;

    // 2. Create workout blocks.
    const blockRows = blocks.map(block => ({
        workout_id: workout.id,
        name: block.name,
        block_order: block.block_order
    }));
    
    const { data: createdBlocks, error: blockError } = await db
        .from("workout_blocks")
        .insert(blockRows)
        .select();
    
    if (blockError) throw blockError;
    
    // 3. Add exercises connected to each block.
    const exerciseRows = [];
    
    blocks.forEach(originalBlock => {
        const createdBlock = createdBlocks.find(
        block => block.block_order === originalBlock.block_order
        );
    
        originalBlock.exercises.forEach(exercise => {
        exerciseRows.push({
            workout_id: workout.id,
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
        });
        });
    });
    
    const { error: exerciseError } = await db
        .from("workout_exercises")
        .insert(exerciseRows);
    
    if (exerciseError) throw exerciseError;

    // 4. Assign workout to selected group for selected date.
    const { error: assignmentError } = await db
      .from("workout_assignments")
      .insert({
        workout_id: workout.id,
        assigned_by: workoutCoachAccess.profile.id,
        target_type: "group",
        target_group_id: groupId,
        assigned_date: assignedDate
      });

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
        target_group_id
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
    const group = availableGroups.find(g => g.id === assignment?.target_group_id);
    const groupName = group?.name || "Group";
    const assignedDate = assignment?.assigned_date || "No date";

    const blocks = [...(workout.workout_blocks || [])]
        .sort((a, b) => a.block_order - b.block_order);

    return `
      <article class="recent-workout-card">
        <div>
          <p class="eyebrow">${workout.focus || "Workout"}</p>
          <h4>${workout.title}</h4>
          <p>${workout.description || "No description added."}</p>
        </div>

        <div class="workout-meta-row">
          <span>${workout.estimated_minutes || "—"} min</span>
          <span>${groupName}</span>
          <span>${assignedDate}</span>
        </div>

        <div class="workout-block-preview">
            ${blocks.map(block => {
                const exercises = [...(block.workout_exercises || [])]
                .sort((a, b) => a.exercise_order - b.exercise_order);

                return `
                <div class="workout-block-preview-item">
                    <strong>${block.name}</strong>
                    <ul class="workout-exercise-preview">
                    ${exercises.map(exercise => `
                        <li>
                        ${exercise.name}
                        ${exercise.sets || exercise.reps ? `<span>${exercise.sets || ""} x ${exercise.reps || ""}</span>` : ""}
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
    renderGroupOptions();

    setTodayAsDefaultDate();
    addExerciseCard();
    await loadRecentWorkouts();

    showWorkoutMessage("");
  } catch (error) {
    console.error(error);
    showWorkoutMessage(error.message || "Could not load workout page.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachWorkoutsPage();

  document.getElementById("add-block-btn").addEventListener("click", addBlockCard);  document.getElementById("workout-form").addEventListener("submit", createWorkoutWithAssignment);
  document.getElementById("refresh-workouts-btn").addEventListener("click", loadRecentWorkouts);
  document.getElementById("coach-workouts-logout-btn").addEventListener("click", logoutCoachWorkouts);
});