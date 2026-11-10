// =====================================================
// REUSABLE WORKOUT PROGRAMS
// =====================================================
// Programs remain linked to future, unstarted calendar assignments. Editing a
// program updates those future occurrences while preserving started history.

let workoutPrograms = [];
let workoutProgramItems = [];
let editingProgramId = null;
let programBuilderItems = [];

const PROGRAM_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function showProgramsMessage(message, isError = false) {
  const element = document.getElementById("programs-message");
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("error-message", Boolean(isError));
}

function isMissingProgramsMigration(error) {
  const text = `${error?.code || ""} ${error?.message || ""} ${error?.details || ""}`;
  return /workout_program/i.test(text) || /PGRST205/i.test(text) || /42P01/i.test(text);
}

function getProgramDefaultStartDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 1 ? 0 : day === 0 ? 1 : 8 - day));
  return formatProgrammingIsoDate(date);
}

function getProgramWorkoutOptions(selectedId = "") {
  if (!recentWorkoutRows.length) {
    return `<option value="">Create or save a workout first</option>`;
  }
  return `
    <option value="">Select saved workout...</option>
    ${recentWorkoutRows.map(workout => `
      <option value="${window.RipCityUI.attr(workout.id)}" ${workout.id === selectedId ? "selected" : ""}>
        ${window.RipCityUI.text(workout.title)}${workout.focus ? ` · ${window.RipCityUI.text(workout.focus)}` : ""}
      </option>
    `).join("")}
  `;
}

function addProgramWorkoutItem(item = {}) {
  programBuilderItems.push({
    id: item.id || null,
    key: item.key || `program-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source_workout_id: item.source_workout_id || "",
    week_number: Number(item.week_number) || 1,
    day_of_week: Number(item.day_of_week) || 1
  });
  renderProgramWorkoutItems();
}

function renderProgramWorkoutItems() {
  const list = document.getElementById("program-workout-list");
  if (!list) return;
  const duration = Number(document.getElementById("program-duration-weeks")?.value) || 4;

  if (!programBuilderItems.length) {
    list.innerHTML = `<div class="empty-state">Add the first workout to the program schedule.</div>`;
    return;
  }

  list.innerHTML = programBuilderItems.map((item, index) => `
    <article class="program-workout-row" data-program-item="${window.RipCityUI.attr(item.key)}">
      <span class="program-workout-number">${index + 1}</span>
      <label>
        Saved Workout
        <select data-program-item-field="source_workout_id">${getProgramWorkoutOptions(item.source_workout_id)}</select>
      </label>
      <label>
        Week
        <select data-program-item-field="week_number">
          ${Array.from({ length: duration }, (_, weekIndex) => `
            <option value="${weekIndex + 1}" ${item.week_number === weekIndex + 1 ? "selected" : ""}>Week ${weekIndex + 1}</option>
          `).join("")}
        </select>
      </label>
      <label>
        Day
        <select data-program-item-field="day_of_week">
          ${PROGRAM_DAY_NAMES.map((day, dayIndex) => `
            <option value="${dayIndex + 1}" ${item.day_of_week === dayIndex + 1 ? "selected" : ""}>${day}</option>
          `).join("")}
        </select>
      </label>
      <div class="program-workout-row-actions">
        <button class="outline-btn small-inline-btn" type="button" data-move-program-item="up" ${index === 0 ? "disabled" : ""} aria-label="Move workout up">↑</button>
        <button class="outline-btn small-inline-btn" type="button" data-move-program-item="down" ${index === programBuilderItems.length - 1 ? "disabled" : ""} aria-label="Move workout down">↓</button>
        <button class="outline-btn small-inline-btn danger-outline-btn" type="button" data-remove-program-item aria-label="Remove workout">Remove</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-program-item]").forEach(row => {
    const index = programBuilderItems.findIndex(item => item.key === row.dataset.programItem);
    row.querySelectorAll("[data-program-item-field]").forEach(field => {
      field.addEventListener("change", () => {
        const name = field.dataset.programItemField;
        programBuilderItems[index][name] = name === "source_workout_id" ? field.value : Number(field.value);
      });
    });
    row.querySelector("[data-remove-program-item]")?.addEventListener("click", () => {
      programBuilderItems.splice(index, 1);
      renderProgramWorkoutItems();
    });
    row.querySelectorAll("[data-move-program-item]").forEach(button => {
      button.addEventListener("click", () => {
        const destination = button.dataset.moveProgramItem === "up" ? index - 1 : index + 1;
        if (destination < 0 || destination >= programBuilderItems.length) return;
        [programBuilderItems[index], programBuilderItems[destination]] = [programBuilderItems[destination], programBuilderItems[index]];
        renderProgramWorkoutItems();
      });
    });
  });
}

function openProgramBuilder(programId = null, seed = null) {
  const builder = document.getElementById("workout-program-builder");
  if (!builder) return;
  editingProgramId = programId;
  const program = workoutPrograms.find(row => row.id === programId);
  const items = workoutProgramItems
    .filter(item => item.program_id === programId)
    .sort((a, b) => a.week_number - b.week_number || a.day_of_week - b.day_of_week || a.item_order - b.item_order);

  document.getElementById("program-name").value = program?.name || seed?.name || "";
  document.getElementById("program-description").value = program?.description || seed?.description || "";
  document.getElementById("program-duration-weeks").value = String(program?.duration_weeks || seed?.durationWeeks || 4);
  const startingItems = program ? items : (seed?.items || []);
  programBuilderItems = startingItems.map(item => ({ ...item, id: item.id || null, key: item.id || item.key || `program-item-${Date.now()}-${Math.random().toString(16).slice(2)}` }));
  if (!programBuilderItems.length) addProgramWorkoutItem();
  else renderProgramWorkoutItems();
  document.getElementById("workout-program-builder-heading").textContent = program ? "Edit the program" : "Build the program";
  document.getElementById("save-program-btn").textContent = program ? "Update Program" : "Save Program";
  builder.classList.remove("hidden");
  builder.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProgramBuilder() {
  editingProgramId = null;
  programBuilderItems = [];
  document.getElementById("workout-program-builder")?.classList.add("hidden");
}

async function saveWorkoutProgram() {
  const name = document.getElementById("program-name")?.value.trim() || "";
  const description = document.getElementById("program-description")?.value.trim() || "";
  const durationWeeks = Number(document.getElementById("program-duration-weeks")?.value) || 4;
  if (!name) return showProgramsMessage("Add a program name before saving.", true);
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 52) {
    return showProgramsMessage("Program duration must be between 1 and 52 weeks.", true);
  }
  if (!programBuilderItems.length || programBuilderItems.some(item => !item.source_workout_id)) {
    return showProgramsMessage("Choose a saved workout for every program row.", true);
  }

  const button = document.getElementById("save-program-btn");
  const wasEditing = Boolean(editingProgramId);
  button.disabled = true;
  button.textContent = "Saving...";
  showProgramsMessage("Saving program...");
  try {
    const { error } = await db.rpc("save_workout_program", {
      check_program_id: editingProgramId,
      check_facility_id: workoutCoachAccess.membership.facility_id,
      check_name: name,
      check_description: description,
      check_duration_weeks: durationWeeks,
      check_items: programBuilderItems.map((item, index) => ({
        id: item.id,
        source_workout_id: item.source_workout_id,
        week_number: item.week_number,
        day_of_week: item.day_of_week,
        item_order: index
      }))
    });
    if (error) throw error;
    closeProgramBuilder();
    await loadWorkoutPrograms();
    showProgramsMessage("Program saved.");
  } catch (error) {
    console.error(error);
    showProgramsMessage(isMissingProgramsMigration(error)
      ? "Run the workout-program migration in staging before saving programs."
      : error.message || "Could not save program.", true);
  } finally {
    button.disabled = false;
    button.textContent = wasEditing ? "Update Program" : "Save Program";
  }
}

function getProgramTargetOptions(type) {
  const options = type === "group"
    ? availableGroups.map(group => ({ id: group.id, label: group.name }))
    : availableMembers.map(member => ({ id: member.memberProfileId, label: member.name }));
  return options.map(option => `<option value="${window.RipCityUI.attr(option.id)}">${window.RipCityUI.text(option.label)}</option>`).join("");
}

function renderWorkoutPrograms() {
  const list = document.getElementById("workout-program-list");
  if (!list) return;
  const coachFilter = document.getElementById("program-coach-filter")?.value || "all";
  const visiblePrograms = workoutCoachAccess?.isAdmin && coachFilter !== "all"
    ? workoutPrograms.filter(program => program.created_by === coachFilter)
    : workoutPrograms;
  if (!visiblePrograms.length) {
    list.innerHTML = `<div class="empty-state">No programs yet. Create one from your saved workout library.</div>`;
    return;
  }

  list.innerHTML = visiblePrograms.map(program => {
    const items = workoutProgramItems
      .filter(item => item.program_id === program.id)
      .sort((a, b) => a.week_number - b.week_number || a.day_of_week - b.day_of_week || a.item_order - b.item_order);
    const workoutCount = new Set(items.map(item => item.source_workout_id)).size;
    return `
      <article class="workout-program-card" data-program-card="${window.RipCityUI.attr(program.id)}">
        <div class="workout-program-card-summary">
          <div>
            <p class="eyebrow">${program.duration_weeks} WEEK PROGRAM</p>
            <h4>${window.RipCityUI.text(program.name)}</h4>
            <p>${window.RipCityUI.text(program.description, "No description added.")}</p>
            <small>${items.length} scheduled workout${items.length === 1 ? "" : "s"} · ${workoutCount} saved workout${workoutCount === 1 ? "" : "s"}${workoutCoachAccess?.isAdmin ? ` · Created by ${window.RipCityUI.text(program.creator?.full_name || program.creator?.email || "facility staff")}` : ""}</small>
          </div>
          <div class="recent-workout-actions">
            <button class="outline-btn small-inline-btn" type="button" data-edit-program>Edit Program</button>
            <button class="outline-btn small-inline-btn danger-outline-btn" type="button" data-archive-program>Archive</button>
            <button class="primary-btn small-inline-btn" type="button" data-toggle-program-launch>Start Program</button>
          </div>
        </div>
        <details class="program-schedule-preview">
          <summary>View ${items.length} scheduled workout${items.length === 1 ? "" : "s"}</summary>
          <div>
            ${items.map(item => {
              const workout = recentWorkoutRows.find(row => row.id === item.source_workout_id);
              return `
                <span>Week ${item.week_number} · ${PROGRAM_DAY_NAMES[item.day_of_week - 1]}</span>
                <strong>${window.RipCityUI.text(workout?.title || "Saved workout")}</strong>
              `;
            }).join("")}
          </div>
        </details>
        <div class="program-launch-form hidden" data-program-launch-form>
          <div class="program-launch-grid">
            <label>
              Assign To
              <select data-program-target-type>
                <option value="group">Group</option>
                <option value="member">Individual Member</option>
              </select>
            </label>
            <label>
              <span data-program-target-label>Group</span>
              <select data-program-target-id>${getProgramTargetOptions("group")}</select>
            </label>
            <label>
              Week 1 Starts
              <input type="date" data-program-start-date value="${getProgramDefaultStartDate()}" />
            </label>
          </div>
          <p class="field-help">The start date is Week 1 Monday. Future, unstarted workouts stay linked to this program; completed history stays unchanged.</p>
          <button class="primary-btn" type="button" data-launch-program>Confirm & Start Program</button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-program-card]").forEach(card => {
    const programId = card.dataset.programCard;
    const launchForm = card.querySelector("[data-program-launch-form]");
    const targetType = card.querySelector("[data-program-target-type]");
    const targetId = card.querySelector("[data-program-target-id]");
    card.querySelector("[data-edit-program]")?.addEventListener("click", () => openProgramBuilder(programId));
    card.querySelector("[data-archive-program]")?.addEventListener("click", event => archiveWorkoutProgram(programId, event.currentTarget));
    card.querySelector("[data-toggle-program-launch]")?.addEventListener("click", () => launchForm.classList.toggle("hidden"));
    targetType?.addEventListener("change", () => {
      card.querySelector("[data-program-target-label]").textContent = targetType.value === "group" ? "Group" : "Member";
      targetId.innerHTML = getProgramTargetOptions(targetType.value);
    });
    card.querySelector("[data-launch-program]")?.addEventListener("click", event => launchWorkoutProgram(programId, card, event.currentTarget));
  });
}

async function archiveWorkoutProgram(programId, button) {
  const program = workoutPrograms.find(row => row.id === programId);
  if (!program || !window.confirm(`Archive ${program.name}? Existing calendar workouts will stay unchanged.`)) return;
  button.disabled = true;
  button.textContent = "Archiving...";
  try {
    const { error } = await db.rpc("archive_workout_program", { check_program_id: programId });
    if (error) throw error;
    await loadWorkoutPrograms();
    showProgramsMessage("Program archived. Existing assigned workouts were not changed.");
  } catch (error) {
    console.error(error);
    showProgramsMessage(error.message || "Could not archive program.", true);
    button.disabled = false;
    button.textContent = "Archive";
  }
}

async function launchWorkoutProgram(programId, card, button) {
  const targetType = card.querySelector("[data-program-target-type]")?.value || "group";
  const targetId = card.querySelector("[data-program-target-id]")?.value || "";
  const startDateInput = card.querySelector("[data-program-start-date]");
  const rawStartDate = startDateInput?.value || "";
  const startDate = rawStartDate
    ? formatProgrammingIsoDate(getProgrammingWeekStart(parseProgrammingDate(rawStartDate)))
    : "";
  if (startDateInput && startDate) startDateInput.value = startDate;
  const targetName = card.querySelector("[data-program-target-id]")?.selectedOptions?.[0]?.textContent || "the selected roster";
  const program = workoutPrograms.find(row => row.id === programId);
  if (!targetId || !startDate) return showProgramsMessage("Choose a target and Week 1 start date.", true);
  if (!window.confirm(`Start ${program?.name || "this program"} for ${targetName} on ${formatDisplayDate(startDate)}? This will create all calendar workouts.`)) return;

  button.disabled = true;
  button.textContent = "Starting...";
  showProgramsMessage("Creating program calendar workouts...");
  try {
    const { error } = await db.rpc("launch_workout_program", {
      check_program_id: programId,
      check_target_type: targetType,
      check_target_id: targetId,
      check_start_date: startDate
    });
    if (error) throw error;
    await loadRecentWorkouts();
    setProgrammingView("calendar");
    document.getElementById("programming-scope-type").value = targetType;
    renderProgrammingScopeOptions();
    document.getElementById("programming-scope-id").value = targetId;
    programmingMonth = getProgrammingMonthStart(parseProgrammingDate(startDate));
    renderProgrammingCalendar();
    showProgramsMessage("Program started and added to the calendar.");
  } catch (error) {
    console.error(error);
    showProgramsMessage(error.message || "Could not start program.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Confirm & Start Program";
  }
}

async function loadWorkoutPrograms() {
  const list = document.getElementById("workout-program-list");
  if (!list || !workoutCoachAccess) return;
  list.innerHTML = `<div class="empty-state">Loading programs...</div>`;
  const facilityId = workoutCoachAccess.membership.facility_id;
  let programsQuery = db.from("workout_programs")
    .select("id, facility_id, name, description, duration_weeks, created_by, created_at, creator:profiles!workout_programs_created_by_fkey(id, full_name, email)")
    .eq("facility_id", facilityId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (!workoutCoachAccess.isAdmin) programsQuery = programsQuery.eq("created_by", workoutCoachAccess.profile.id);
  const [{ data: programs, error: programsError }, { data: items, error: itemsError }] = await Promise.all([
    programsQuery,
    db.from("workout_program_items").select("id, program_id, source_workout_id, week_number, day_of_week, item_order").order("week_number").order("day_of_week").order("item_order")
  ]);
  const error = programsError || itemsError;
  if (error) {
    console.error(error);
    workoutPrograms = [];
    workoutProgramItems = [];
    list.innerHTML = `<div class="empty-state">${isMissingProgramsMigration(error) ? "Apply the workout-program migration to enable reusable programs." : "Could not load programs."}</div>`;
    return;
  }
  workoutPrograms = programs || [];
  const programIds = new Set(workoutPrograms.map(program => program.id));
  workoutProgramItems = (items || []).filter(item => programIds.has(item.program_id));
  renderProgramCoachFilter();
  renderWorkoutPrograms();
}

function renderProgramCoachFilter() {
  const wrapper = document.getElementById("program-admin-filter-wrap");
  const select = document.getElementById("program-coach-filter");
  if (!wrapper || !select) return;
  wrapper.classList.toggle("hidden", !workoutCoachAccess?.isAdmin);
  if (!workoutCoachAccess?.isAdmin) return;
  const previous = select.value;
  const creators = new Map();
  workoutPrograms.forEach(program => {
    creators.set(program.created_by, program.creator?.full_name || program.creator?.email || "Facility staff");
  });
  select.innerHTML = `<option value="all">All coaches</option>${[...creators.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, label]) => `<option value="${window.RipCityUI.attr(id)}">${window.RipCityUI.text(label)}</option>`)
    .join("")}`;
  select.value = creators.has(previous) ? previous : "all";
}

function initWorkoutPrograms() {
  document.getElementById("create-program-btn")?.addEventListener("click", () => openProgramBuilder());
  document.getElementById("cancel-program-btn")?.addEventListener("click", closeProgramBuilder);
  document.getElementById("add-program-workout-btn")?.addEventListener("click", () => addProgramWorkoutItem());
  document.getElementById("save-program-btn")?.addEventListener("click", saveWorkoutProgram);
  document.getElementById("program-coach-filter")?.addEventListener("change", renderWorkoutPrograms);
  document.getElementById("program-duration-weeks")?.addEventListener("change", () => {
    const durationInput = document.getElementById("program-duration-weeks");
    const duration = Math.max(1, Math.min(52, Number(durationInput.value) || 1));
    durationInput.value = String(duration);
    programBuilderItems.forEach(item => { item.week_number = Math.min(item.week_number, duration); });
    renderProgramWorkoutItems();
  });
}
