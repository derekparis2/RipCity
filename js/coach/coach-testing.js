// =====================================================
// COACH TESTING DAYS
// =====================================================
// Testing Days snapshot a deduplicated roster and ordered test definitions.
// Coaches and facility admins enter official results. Member entry remains
// intentionally unavailable until Rip City makes that separate decision.

let testingAccess = null;
let testingGroups = [];
let testingMembers = [];
let testingGroupMemberships = [];
let testingDays = [];
let testingTests = [];
let testingTemplates = [];
let selectedTestingGroupIds = new Set();
let selectedTestingMemberIds = new Set();
let draggedTestingTestKey = null;
let activeTestingResultDay = null;
let testingResultMode = "athlete";
let testingResultFocusId = null;
let testingResultDrafts = new Map();
let testingResultsReadOnly = false;
let testingDayExpansionInitialized = false;
const expandedTestingDayIds = new Set();

const TEST_PRESETS = {
  "10-Yard Sprint": { unit: "seconds", inputType: "time", rankingDirection: "lower" },
  "20-Yard Sprint": { unit: "seconds", inputType: "time", rankingDirection: "lower" },
  "Vertical Jump": { unit: "inches", inputType: "number", rankingDirection: "higher" },
  "Broad Jump": { unit: "inches", inputType: "number", rankingDirection: "higher" },
  "Exit Velocity": { unit: "mph", inputType: "number", rankingDirection: "higher" },
  "Throwing Velocity": { unit: "mph", inputType: "number", rankingDirection: "higher" },
  "Back Squat": { unit: "lb", inputType: "number", rankingDirection: "higher" },
  "Bench Press": { unit: "lb", inputType: "number", rankingDirection: "higher" },
  "Trap Bar Deadlift": { unit: "lb", inputType: "number", rankingDirection: "higher" }
};

function createTestingClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  if (window.crypto?.getRandomValues) {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, character => (
      Number(character) ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4
    ).toString(16));
  }

  // This key only identifies an unsaved test card in this browser. Postgres
  // generates the permanent record ID when the Testing Day is saved.
  return `testing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showTestingMessage(message, isError = false) {
  const element = document.getElementById("testing-day-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTestingDate(dateKey) {
  if (!dateKey) return "Date unavailable";
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function normalizeJoinedOne(value) {
  return Array.isArray(value) ? value[0] : value;
}

function presetDefinitions() {
  return Object.entries(TEST_PRESETS).map(([name, definition]) => ({ name, ...definition }));
}

function availableTestingDefinitions() {
  const definitions = [...testingTemplates, ...presetDefinitions()];
  const seen = new Set();
  return definitions.filter(definition => {
    const key = `${definition.name.toLowerCase()}|${(definition.unit || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderTestingTestSuggestions() {
  const list = document.getElementById("testing-test-suggestions");
  if (!list) return;
  list.innerHTML = availableTestingDefinitions()
    .map(definition => `<option value="${window.RipCityUI.attr(definition.name)}">${window.RipCityUI.text(definition.unit || "Custom result")}</option>`)
    .join("");
}

async function loadTestingTemplates() {
  const { data, error } = await db.from("testing_test_templates")
    .select("id,name,description,unit,input_type,ranking_direction")
    .eq("facility_id", testingAccess.facilityId)
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  testingTemplates = (data || []).map(template => ({
    ...template,
    inputType: template.input_type,
    rankingDirection: template.ranking_direction
  }));
  renderTestingTestSuggestions();
}

async function loadTestingFoundation() {
  const facilityId = testingAccess.facilityId;
  const [{ data: groups, error: groupError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from("groups")
      .select("id,name,member_type,group_type")
      .eq("facility_id", facilityId)
      .order("name", { ascending: true }),
    db.from("facility_members")
      .select(`
        id,
        role,
        profile:profiles!facility_members_profile_id_fkey(id,full_name,email),
        member_profile:member_profiles(id,member_type,sport,age_group)
      `)
      .eq("facility_id", facilityId)
      .eq("status", "approved")
      .in("role", ["athlete", "h2k_member"])
  ]);

  if (groupError) throw groupError;
  if (membershipError) throw membershipError;

  testingGroups = groups || [];
  testingMembers = (memberships || []).map(row => {
    const memberProfile = normalizeJoinedOne(row.member_profile);
    return {
      id: memberProfile?.id,
      memberType: memberProfile?.member_type || (row.role === "h2k_member" ? "h2k" : "athlete"),
      name: row.profile?.full_name || "Unnamed Member",
      email: row.profile?.email || "",
      sport: memberProfile?.sport || "",
      ageGroup: memberProfile?.age_group || ""
    };
  }).filter(member => member.id);

  if (testingMembers.length) {
    const { data, error } = await db.from("group_members")
      .select("group_id,member_profile_id")
      .in("member_profile_id", testingMembers.map(member => member.id));
    if (error) throw error;
    testingGroupMemberships = data || [];
  } else {
    testingGroupMemberships = [];
  }

  renderTestingGroups();
  renderTestingMembers();
  updateTestingRosterSummary();
  await loadTestingTemplates();
}

function memberGroupNames(memberId) {
  const groupIds = new Set(testingGroupMemberships
    .filter(row => row.member_profile_id === memberId)
    .map(row => row.group_id));
  return testingGroups.filter(group => groupIds.has(group.id)).map(group => group.name);
}

function renderTestingGroups(selectedIds = [...selectedTestingGroupIds]) {
  const list = document.getElementById("testing-group-list");
  if (!list) return;
  const selected = new Set(selectedIds);

  if (!testingGroups.length) {
    list.innerHTML = `<div class="empty-state">No facility groups are available.</div>`;
    return;
  }

  list.innerHTML = testingGroups.map(group => `
    <label class="assignment-checkbox-chip">
      <span><strong>${window.RipCityUI.text(group.name)}</strong><small>${window.RipCityUI.text(group.member_type === "h2k" ? "H2K" : group.member_type)}</small></span>
      <input data-testing-group type="checkbox" value="${window.RipCityUI.attr(group.id)}" ${selected.has(group.id) ? "checked" : ""} />
    </label>
  `).join("");
}

function renderTestingMembers(selectedIds = [...selectedTestingMemberIds]) {
  const list = document.getElementById("testing-member-list");
  if (!list) return;
  const selected = new Set(selectedIds);
  const search = document.getElementById("testing-member-search")?.value.trim().toLowerCase() || "";
  const filtered = testingMembers.filter(member => {
    const groupNames = memberGroupNames(member.id);
    return !search || `${member.name} ${member.email} ${member.memberType} ${groupNames.join(" ")}`.toLowerCase().includes(search);
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No matching approved members.</div>`;
    return;
  }

  list.innerHTML = filtered.map(member => {
    const groups = memberGroupNames(member.id);
    return `
      <label class="assignment-checkbox-chip">
        <span>
          <strong>${window.RipCityUI.text(member.name)}</strong>
          <small>${window.RipCityUI.text(member.memberType === "h2k" ? "H2K" : "Athlete")}${groups.length ? ` · ${window.RipCityUI.text(groups.join(", "))}` : " · No group"}</small>
        </span>
        <input data-testing-member type="checkbox" value="${window.RipCityUI.attr(member.id)}" ${selected.has(member.id) ? "checked" : ""} />
      </label>
    `;
  }).join("");
}

function selectedRosterMembers() {
  const groupMemberIds = testingGroupMemberships
    .filter(row => selectedTestingGroupIds.has(row.group_id))
    .map(row => row.member_profile_id);
  return testingMembers.filter(member => selectedTestingMemberIds.has(member.id) || groupMemberIds.includes(member.id));
}

function updateTestingRosterSummary() {
  const members = selectedRosterMembers();
  const count = document.getElementById("testing-participant-count");
  const roster = document.getElementById("testing-selected-roster");
  const outline = document.getElementById("testing-outline-roster");
  if (count) count.textContent = `${members.length} selected`;
  const rosterMarkup = members.length
    ? members.map(member => `<span class="testing-roster-chip">${window.RipCityUI.text(member.name)}</span>`).join("")
    : `<span class="muted-small">No participants selected yet.</span>`;
  if (roster) roster.innerHTML = rosterMarkup;
  if (outline) {
    outline.innerHTML = members.length
      ? members.map(member => `<div class="testing-outline-item"><strong>${window.RipCityUI.text(member.name)}</strong><span>${window.RipCityUI.text(member.memberType === "h2k" ? "H2K" : "Athlete")}</span></div>`).join("")
      : `<span class="muted-small">No participants selected.</span>`;
  }
  renderTestingBuilderReview();
}

function renderTestingBuilderReview() {
  const review = document.getElementById("testing-builder-review");
  if (!review) return;
  const name = document.getElementById("testing-day-name")?.value.trim() || "Untitled Testing Day";
  const description = document.getElementById("testing-day-description")?.value.trim() || "No description added";
  const date = document.getElementById("testing-day-date")?.value;
  const members = selectedRosterMembers();
  const namedTests = testingTests.filter(test => test.name.trim());

  review.innerHTML = `
    <div class="workout-builder-review-heading">
      <div><p class="eyebrow">TESTING DAY PREVIEW</p><strong>${window.RipCityUI.text(name)}</strong><small>${window.RipCityUI.text(description)}</small></div>
      <div class="workout-builder-review-stats"><span>${namedTests.length} test${namedTests.length === 1 ? "" : "s"}</span><span>${members.length} participant${members.length === 1 ? "" : "s"}</span></div>
    </div>
    <div class="workout-builder-review-blocks">
      ${namedTests.length ? namedTests.map((test, index) => `<div><strong>${index + 1}. ${window.RipCityUI.text(test.name)}</strong><span>${window.RipCityUI.text(test.unit || test.inputType)}</span></div>`).join("") : `<p>Add a named test to see the Testing Day preview.</p>`}
    </div>
    <p>${members.length} participant${members.length === 1 ? "" : "s"} · ${date ? window.RipCityUI.text(formatTestingDate(date)) : "Choose a date"}</p>
  `;
}

function updateTestingTargetFields() {
  const targetType = document.getElementById("testing-target-type")?.value || "groups";
  document.getElementById("testing-group-field")?.classList.toggle("hidden", targetType === "members");
  document.getElementById("testing-member-field")?.classList.toggle("hidden", targetType === "groups");
}

function makeTest(definition = {}) {
  return {
    key: definition.key || createTestingClientId(),
    name: definition.name || "",
    description: definition.description || "",
    unit: definition.unit || "",
    inputType: definition.inputType || definition.input_type || "number",
    rankingDirection: definition.rankingDirection || definition.ranking_direction || "higher"
  };
}

function renderTestingTests() {
  const list = document.getElementById("testing-test-list");
  const outline = document.getElementById("testing-outline-tests");
  if (!list) return;

  if (!testingTests.length) {
    list.innerHTML = `<div class="empty-state">Add at least one test to build the day.</div>`;
    if (outline) outline.innerHTML = `<span class="muted-small">No tests added.</span>`;
    renderTestingBuilderReview();
    return;
  }

  list.innerHTML = testingTests.map((test, index) => `
    <article class="testing-test-row" data-testing-test="${window.RipCityUI.attr(test.key)}" draggable="false">
      <button class="builder-drag-handle testing-test-drag-handle" type="button" draggable="true" aria-label="Drag ${window.RipCityUI.attr(test.name || `test ${index + 1}`)} to reorder">⋮⋮</button>
      <span class="testing-test-order">${index + 1}</span>
      <label>Test Name<input data-test-field="name" list="testing-test-suggestions" value="${window.RipCityUI.attr(test.name)}" placeholder="10-Yard Sprint" required /></label>
      <label>Unit<input data-test-field="unit" value="${window.RipCityUI.attr(test.unit)}" placeholder="seconds, inches, mph..." /></label>
      <label>Input<select data-test-field="inputType"><option value="number" ${test.inputType === "number" ? "selected" : ""}>Number</option><option value="time" ${test.inputType === "time" ? "selected" : ""}>Time</option><option value="text" ${test.inputType === "text" ? "selected" : ""}>Text</option></select></label>
      <label>Ranking<select data-test-field="rankingDirection"><option value="higher" ${test.rankingDirection === "higher" ? "selected" : ""}>Higher is better</option><option value="lower" ${test.rankingDirection === "lower" ? "selected" : ""}>Lower is better</option><option value="none" ${test.rankingDirection === "none" ? "selected" : ""}>Do not rank</option></select></label>
      <div class="testing-test-actions">
        <details class="builder-more-menu"><summary aria-label="More test actions">•••</summary><div class="builder-more-menu-popover">
          <button type="button" data-test-action="up" ${index === 0 ? "disabled" : ""}>Move Up</button>
          <button type="button" data-test-action="down" ${index === testingTests.length - 1 ? "disabled" : ""}>Move Down</button>
          <button class="danger-text" type="button" data-test-action="remove">Remove</button>
        </div></details>
      </div>
    </article>
  `).join("");

  if (outline) {
    outline.innerHTML = testingTests.map((test, index) => `
      <div class="testing-outline-item"><strong>${index + 1}. ${window.RipCityUI.text(test.name || "Unnamed test")}</strong><span>${window.RipCityUI.text(test.unit || test.inputType)}</span></div>
    `).join("");
  }
  renderTestingBuilderReview();
}

function clearTestingDragState() {
  document.querySelectorAll(".testing-test-row.is-dragging, .testing-test-row.drop-before, .testing-test-row.drop-after")
    .forEach(row => row.classList.remove("is-dragging", "drop-before", "drop-after"));
  draggedTestingTestKey = null;
}

function setOpenTestingStep(stepName) {
  document.querySelectorAll("[data-testing-step]").forEach(step => {
    const open = step.dataset.testingStep === stepName;
    step.classList.toggle("is-collapsed", !open);
    step.classList.toggle("is-active", open);
    const button = step.querySelector("[data-testing-step-toggle]");
    if (button) {
      button.textContent = open ? "Collapse" : step.dataset.testingStep === "details" ? "Edit Details" : step.dataset.testingStep === "tests" ? "Edit Tests" : "Edit Assignment";
      button.setAttribute("aria-expanded", String(open));
    }
  });
  document.querySelector(`[data-testing-step="${stepName}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updateTestFromField(target) {
  const row = target.closest("[data-testing-test]");
  const test = testingTests.find(item => item.key === row?.dataset.testingTest);
  if (!test) return;
  const field = target.dataset.testField;
  test[field] = target.value;

  const savedDefinition = availableTestingDefinitions()
    .find(definition => definition.name.toLowerCase() === target.value.trim().toLowerCase());
  if (field === "name" && savedDefinition) {
    Object.assign(test, {
      description: savedDefinition.description || "",
      unit: savedDefinition.unit || "",
      inputType: savedDefinition.inputType || savedDefinition.input_type || "number",
      rankingDirection: savedDefinition.rankingDirection || savedDefinition.ranking_direction || "none"
    });
    renderTestingTests();
    return;
  }
  renderTestingBuilderReview();
}

function handleTestAction(button) {
  const row = button.closest("[data-testing-test]");
  const index = testingTests.findIndex(item => item.key === row?.dataset.testingTest);
  if (index < 0) return;
  const action = button.dataset.testAction;

  if (action === "remove") testingTests.splice(index, 1);
  if (action === "up" && index > 0) [testingTests[index - 1], testingTests[index]] = [testingTests[index], testingTests[index - 1]];
  if (action === "down" && index < testingTests.length - 1) [testingTests[index], testingTests[index + 1]] = [testingTests[index + 1], testingTests[index]];
  renderTestingTests();
}

function handleTestingTestDragStart(event) {
  const handle = event.target.closest(".testing-test-drag-handle");
  const row = handle?.closest("[data-testing-test]");
  if (!row) return;
  draggedTestingTestKey = row.dataset.testingTest;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTestingTestKey);
}

function handleTestingTestDragOver(event) {
  if (!draggedTestingTestKey) return;
  const row = event.target.closest("[data-testing-test]");
  if (!row || row.dataset.testingTest === draggedTestingTestKey) return;
  event.preventDefault();
  document.querySelectorAll(".testing-test-row.drop-before, .testing-test-row.drop-after")
    .forEach(item => item.classList.remove("drop-before", "drop-after"));
  const placement = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2 ? "before" : "after";
  row.classList.add(`drop-${placement}`);
  row.dataset.dropPlacement = placement;
}

function handleTestingTestDrop(event) {
  if (!draggedTestingTestKey) return;
  const row = event.target.closest("[data-testing-test]");
  if (!row || row.dataset.testingTest === draggedTestingTestKey) return clearTestingDragState();
  event.preventDefault();
  const fromIndex = testingTests.findIndex(test => test.key === draggedTestingTestKey);
  let toIndex = testingTests.findIndex(test => test.key === row.dataset.testingTest);
  const [moved] = testingTests.splice(fromIndex, 1);
  if (fromIndex < toIndex) toIndex -= 1;
  if (row.dataset.dropPlacement === "after") toIndex += 1;
  testingTests.splice(toIndex, 0, moved);
  clearTestingDragState();
  renderTestingTests();
}

function resetTestingEditor({ open = true } = {}) {
  document.getElementById("testing-day-form")?.reset();
  document.getElementById("testing-day-id").value = "";
  document.getElementById("testing-day-date").value = localDateKey();
  document.getElementById("testing-editor-title").textContent = "Testing Day Details";
  selectedTestingGroupIds = new Set();
  selectedTestingMemberIds = new Set();
  document.getElementById("testing-target-type").value = "groups";
  updateTestingTargetFields();
  renderTestingGroups();
  renderTestingMembers();
  testingTests = [makeTest(TEST_PRESETS["10-Yard Sprint"] ? { name: "10-Yard Sprint", ...TEST_PRESETS["10-Yard Sprint"] } : {})];
  renderTestingTests();
  updateTestingRosterSummary();
  document.getElementById("testing-editor")?.classList.toggle("hidden", !open);
  if (open) {
    setOpenTestingStep("details");
    document.getElementById("testing-day-name")?.focus();
  }
}

function fillTestingEditor(day) {
  document.getElementById("testing-day-id").value = day.id;
  document.getElementById("testing-day-name").value = day.name || "";
  document.getElementById("testing-day-description").value = day.description || "";
  document.getElementById("testing-day-date").value = day.testing_date || localDateKey();
  document.getElementById("testing-editor-title").textContent = `Edit ${day.name}`;
  selectedTestingGroupIds = new Set((day.testing_day_groups || []).map(row => row.group_id));
  selectedTestingMemberIds = new Set((day.testing_day_participants || [])
    .filter(row => row.selected_individually)
    .map(row => row.member_profile_id));
  document.getElementById("testing-target-type").value = selectedTestingGroupIds.size && selectedTestingMemberIds.size
    ? "both"
    : selectedTestingMemberIds.size ? "members" : "groups";
  updateTestingTargetFields();
  renderTestingGroups();
  renderTestingMembers();
  testingTests = (day.testing_day_tests || [])
    .sort((a, b) => a.test_order - b.test_order)
    .map(test => makeTest(test));
  renderTestingTests();
  updateTestingRosterSummary();
  document.getElementById("testing-editor")?.classList.remove("hidden");
  setOpenTestingStep("details");
  document.getElementById("testing-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveTestingDay(event) {
  event.preventDefault();
  const submitter = event.submitter;
  const status = submitter?.value === "scheduled" ? "scheduled" : "draft";
  const participantIds = selectedRosterMembers().map(member => member.id);

  if (!participantIds.length) {
    showTestingMessage("Select at least one group with members or one individual member.", true);
    return;
  }
  if (!testingTests.length || testingTests.some(test => !test.name.trim())) {
    showTestingMessage("Add a name for every test before saving.", true);
    return;
  }

  if (status === "scheduled") {
    const confirmed = window.confirm([
      "Schedule this Testing Day?",
      "",
      `Name: ${document.getElementById("testing-day-name").value.trim()}`,
      `Date: ${formatTestingDate(document.getElementById("testing-day-date").value)}`,
      `Roster: ${participantIds.length} participant${participantIds.length === 1 ? "" : "s"}`,
      `Tests: ${testingTests.length}`
    ].join("\n"));
    if (!confirmed) return;
  }

  const buttons = Array.from(event.currentTarget.querySelectorAll('button[type="submit"]'));
  buttons.forEach(button => { button.disabled = true; });
  showTestingMessage(status === "scheduled" ? "Scheduling Testing Day..." : "Saving draft...");

  try {
    const { data, error } = await db.rpc("save_testing_day", {
      p_testing_day_id: document.getElementById("testing-day-id").value || null,
      p_name: document.getElementById("testing-day-name").value.trim(),
      p_description: document.getElementById("testing-day-description").value.trim() || null,
      p_testing_date: document.getElementById("testing-day-date").value,
      p_status: status,
      p_group_ids: [...selectedTestingGroupIds],
      p_member_profile_ids: [...selectedTestingMemberIds],
      p_tests: testingTests.map(test => ({
        name: test.name.trim(),
        description: test.description || "",
        unit: test.unit.trim(),
        input_type: test.inputType,
        ranking_direction: test.rankingDirection
      }))
    });
    if (error) throw error;

    const saved = data?.[0];
    showTestingMessage(`${status === "scheduled" ? "Testing Day scheduled" : "Draft saved"} for ${saved?.participant_count || participantIds.length} participants.`);
    resetTestingEditor({ open: true });
    await Promise.all([loadTestingDays(), loadTestingTemplates()]);
  } catch (error) {
    console.error(error);
    showTestingMessage(error.message || "Could not save the Testing Day.", true);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function loadTestingDays() {
  const list = document.getElementById("testing-day-list");
  if (!list) return;

  const { data, error } = await db.from("testing_days")
    .select(`
      id,name,description,testing_date,status,created_by,created_at,updated_at,
      creator:profiles!testing_days_created_by_fkey(full_name),
      testing_day_tests(id,name,description,unit,input_type,ranking_direction,test_order,testing_results(id,testing_day_participant_id,result_status)),
      testing_day_groups(group_id),
      testing_day_participants(id,member_profile_id,selected_individually,participation_status)
    `)
    .eq("facility_id", testingAccess.facilityId)
    .order("testing_date", { ascending: false });

  if (error) throw error;
  testingDays = data || [];
  if (!testingDayExpansionInitialized) {
    testingDays.filter(day => day.status !== "completed").forEach(day => expandedTestingDayIds.add(day.id));
    testingDayExpansionInitialized = true;
  }
  renderTestingDayList();
}

function testingResultKey(testId, participantId) {
  return `${testId}|${participantId}`;
}

function testingParticipantName(participant) {
  return testingMembers.find(member => member.id === participant.member_profile_id)?.name || "Unknown member";
}

async function openTestingResults(day, { readOnly = false, memberProfileId = null } = {}) {
  activeTestingResultDay = day;
  testingResultsReadOnly = readOnly;
  testingResultMode = "athlete";
  testingResultFocusId = day.testing_day_participants?.find(participant => participant.member_profile_id === memberProfileId)?.id
    || day.testing_day_participants?.[0]?.id
    || null;
  testingResultDrafts = new Map();
  const testIds = (day.testing_day_tests || []).map(test => test.id);
  if (testIds.length) {
    const { data, error } = await db.from("testing_results")
      .select("id,testing_day_test_id,testing_day_participant_id,result_status,numeric_value,text_value,notes")
      .in("testing_day_test_id", testIds);
    if (error) throw error;
    (data || []).forEach(result => testingResultDrafts.set(
      testingResultKey(result.testing_day_test_id, result.testing_day_participant_id),
      { resultStatus: result.result_status || "recorded", numericValue: result.numeric_value ?? "", textValue: result.text_value ?? "", notes: result.notes || "" }
    ));
  }
  document.getElementById("testing-results-title").textContent = day.name;
  document.getElementById("testing-results-subtitle").textContent = readOnly
    ? `${formatTestingDate(day.testing_date)} · Review by athlete or rank the recorded results by test.`
    : `${formatTestingDate(day.testing_date)} · Enter results by athlete or by test.`;
  document.getElementById("edit-testing-results-btn")?.classList.toggle("hidden", !readOnly);
  document.getElementById("testing-results-save-actions")?.classList.toggle("hidden", readOnly);
  document.getElementById("testing-results-panel")?.classList.toggle("is-reviewing", readOnly);
  document.querySelector('[data-result-mode="athlete"]').textContent = "By Athlete";
  document.querySelector('[data-result-mode="test"]').textContent = readOnly ? "Test Rankings" : "By Test";
  document.getElementById("testing-results-panel")?.classList.remove("hidden");
  renderTestingResultEntry();
  document.getElementById("testing-results-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeTestingResults() {
  activeTestingResultDay = null;
  testingResultDrafts = new Map();
  document.getElementById("testing-results-panel")?.classList.add("hidden");
}

function testingResultDisplay(test, draft) {
  if (!draft) return "Pending";
  if (draft.resultStatus === "not_tested") return "Did not complete";
  const value = test.input_type === "text" ? draft.textValue : draft.numericValue;
  return `${value === "" || value == null ? "Pending" : value}${value !== "" && value != null && test.unit ? ` ${test.unit}` : ""}`;
}

function rankedTestingParticipants(test, participants) {
  if (!test) return [];
  const rows = participants.map(participant => {
    const draft = testingResultDrafts.get(testingResultKey(test.id, participant.id));
    const numeric = draft?.resultStatus === "recorded" && draft.numericValue !== "" && draft.numericValue != null
      ? Number(draft.numericValue)
      : null;
    return { participant, draft, numeric };
  });
  if (test.ranking_direction === "none" || test.input_type === "text") {
    return rows.map(row => ({ ...row, rank: null }));
  }
  const sortedRows = rows.sort((a, b) => {
    if (a.numeric == null) return 1;
    if (b.numeric == null) return -1;
    return test.ranking_direction === "lower" ? a.numeric - b.numeric : b.numeric - a.numeric;
  });
  let previousValue = null;
  let currentRank = 0;
  return sortedRows.map((row, index) => {
    if (row.numeric == null) return { ...row, rank: null };
    if (previousValue === null || row.numeric !== previousValue) currentRank = index + 1;
    previousValue = row.numeric;
    return { ...row, rank: currentRank };
  });
}

function renderTestingResultEntry() {
  if (!activeTestingResultDay) return;
  const tests = [...(activeTestingResultDay.testing_day_tests || [])].sort((a, b) => a.test_order - b.test_order);
  const participants = activeTestingResultDay.testing_day_participants || [];
  const focusSelect = document.getElementById("testing-result-focus-select");
  const focusLabel = document.getElementById("testing-result-focus-label");
  const participantStatusButton = document.getElementById("testing-participant-status-btn");
  const grid = document.getElementById("testing-result-grid");
  document.querySelectorAll("[data-result-mode]").forEach(button => button.classList.toggle("is-active", button.dataset.resultMode === testingResultMode));

  const focusOptions = testingResultMode === "athlete"
    ? participants.map(participant => ({ id: participant.id, label: testingParticipantName(participant) }))
    : tests.map(test => ({ id: test.id, label: test.name }));
  if (!focusOptions.some(option => option.id === testingResultFocusId)) testingResultFocusId = focusOptions[0]?.id || null;
  focusLabel.textContent = testingResultMode === "athlete" ? "Athlete" : "Test";
  focusSelect.innerHTML = focusOptions.map(option => `<option value="${window.RipCityUI.attr(option.id)}" ${option.id === testingResultFocusId ? "selected" : ""}>${window.RipCityUI.text(option.label)}</option>`).join("");
  const focusedParticipant = testingResultMode === "athlete"
    ? participants.find(participant => participant.id === testingResultFocusId)
    : null;
  participantStatusButton?.classList.toggle("hidden", !focusedParticipant || testingResultsReadOnly);
  if (participantStatusButton && focusedParticipant) {
    const absent = focusedParticipant.participation_status === "did_not_participate";
    participantStatusButton.textContent = absent ? "Restore Athlete" : "Mark Did Not Participate";
    participantStatusButton.dataset.participantId = focusedParticipant.id;
    participantStatusButton.dataset.nextStatus = absent ? "pending" : "did_not_participate";
  }

  const rows = testingResultMode === "athlete"
    ? tests.map(test => ({ test, participant: participants.find(item => item.id === testingResultFocusId) }))
    : rankedTestingParticipants(tests.find(item => item.id === testingResultFocusId), participants)
      .map(({ participant, rank }) => ({ test: tests.find(item => item.id === testingResultFocusId), participant, rank }));
  const usableRows = rows.filter(row => row.test && row.participant);
  grid.innerHTML = usableRows.map(({ test, participant, rank }) => {
    const key = testingResultKey(test.id, participant.id);
    const draft = testingResultDrafts.get(key) || { resultStatus: "recorded", numericValue: "", textValue: "", notes: "" };
    const isText = test.input_type === "text";
    const isNotTested = draft.resultStatus === "not_tested";
    const isAbsent = participant.participation_status === "did_not_participate";
    if (testingResultsReadOnly) {
      const canRank = testingResultMode === "test" && test.ranking_direction !== "none" && test.input_type !== "text" && !isAbsent && !isNotTested && draft.numericValue !== "" && draft.numericValue != null;
      return `<article class="testing-result-review-row ${isNotTested ? "is-not-tested" : ""} ${isAbsent ? "is-absent" : ""}">
        ${testingResultMode === "test" ? `<span class="testing-result-rank">${canRank && rank ? `#${rank}` : "—"}</span>` : ""}
        <div><h4>${window.RipCityUI.text(testingResultMode === "athlete" ? test.name : testingParticipantName(participant))}</h4><p>${window.RipCityUI.text(testingResultMode === "athlete" ? (test.unit || test.input_type) : test.name)}</p></div>
        <strong>${window.RipCityUI.text(isAbsent ? "Did not participate" : testingResultDisplay(test, draft))}</strong>
        ${draft.notes ? `<span class="testing-result-review-note">${window.RipCityUI.text(draft.notes)}</span>` : ""}
      </article>`;
    }
    return `<article class="testing-result-row ${isNotTested ? "is-not-tested" : ""} ${isAbsent ? "is-absent" : ""}" data-result-key="${window.RipCityUI.attr(key)}" data-result-test="${window.RipCityUI.attr(test.id)}" data-result-participant="${window.RipCityUI.attr(participant.id)}">
      <div><h4>${window.RipCityUI.text(testingResultMode === "athlete" ? test.name : testingParticipantName(participant))}</h4><p>${window.RipCityUI.text(testingResultMode === "athlete" ? (test.unit || test.input_type) : test.name)}</p></div>
      <label class="testing-result-value ${isNotTested || isAbsent ? "is-disabled" : ""}">Result<input data-result-value type="${isText ? "text" : "number"}" ${test.input_type === "time" ? 'step="0.01"' : 'step="any"'} value="${window.RipCityUI.attr(isText ? draft.textValue : draft.numericValue)}" placeholder="${window.RipCityUI.attr(test.unit || "Result")}" ${isNotTested || isAbsent ? "disabled" : ""} /></label>
      <label>Notes<textarea data-result-notes rows="1" placeholder="Optional note" ${isAbsent ? "disabled" : ""}>${window.RipCityUI.text(draft.notes)}</textarea></label>
      <label class="testing-not-tested-toggle"><input type="checkbox" data-result-not-tested ${isNotTested ? "checked" : ""} ${isAbsent ? "disabled" : ""} /><span>Did not complete</span></label>
    </article>`;
  }).join("") || `<div class="empty-state">This Testing Day needs both tests and participants.</div>`;
  const completed = [...testingResultDrafts.values()].filter(result => result.resultStatus === "not_tested" || String(result.numericValue).trim() || String(result.textValue).trim()).length;
  const absentCount = participants.filter(participant => participant.participation_status === "did_not_participate").length;
  const accounted = completed + (absentCount * tests.length);
  document.getElementById("testing-result-progress").textContent = `${accounted} of ${tests.length * participants.length} outcomes accounted for`;
}

function updateTestingResultDraft(target) {
  const row = target.closest("[data-result-key]");
  if (!row) return;
  const test = activeTestingResultDay?.testing_day_tests?.find(item => item.id === row.dataset.resultTest);
  const draft = testingResultDrafts.get(row.dataset.resultKey) || { resultStatus: "recorded", numericValue: "", textValue: "", notes: "" };
  if (target.matches("[data-result-not-tested]")) {
    draft.resultStatus = target.checked ? "not_tested" : "recorded";
    if (target.checked) {
      draft.numericValue = "";
      draft.textValue = "";
    }
  }
  if (target.matches("[data-result-value]")) {
    if (test?.input_type === "text") draft.textValue = target.value;
    else draft.numericValue = target.value;
  }
  if (target.matches("[data-result-notes]")) draft.notes = target.value;
  testingResultDrafts.set(row.dataset.resultKey, draft);
  if (target.matches("[data-result-not-tested]")) renderTestingResultEntry();
}

async function saveVisibleTestingResults() {
  if (!activeTestingResultDay) return;
  const button = document.getElementById("save-testing-results-btn");
  const absentParticipantIds = new Set((activeTestingResultDay.testing_day_participants || [])
    .filter(participant => participant.participation_status === "did_not_participate")
    .map(participant => participant.id));
  const rows = [...document.querySelectorAll("#testing-result-grid [data-result-key]")]
    .filter(row => !absentParticipantIds.has(row.dataset.resultParticipant));
  const results = rows.map(row => {
    const draft = testingResultDrafts.get(row.dataset.resultKey) || {};
    return {
      testing_day_test_id: row.dataset.resultTest,
      testing_day_participant_id: row.dataset.resultParticipant,
      result_status: draft.resultStatus || "recorded",
      numeric_value: draft.numericValue === "" || draft.numericValue == null ? null : Number(draft.numericValue),
      text_value: draft.textValue?.trim() || null,
      notes: draft.notes?.trim() || null
    };
  });
  if (!results.length) {
    showTestingMessage("This athlete is marked as not participating. Restore them before entering results.", true);
    return;
  }
  const originalLabel = button.textContent;
  try {
    button.disabled = true;
    button.textContent = "Saving...";
    const { error } = await db.rpc("save_testing_results", { p_testing_day_id: activeTestingResultDay.id, p_results: results });
    if (error) throw error;
    showTestingMessage("Testing results saved.");
    button.textContent = "Saved ✓";
    await loadTestingDays();
    activeTestingResultDay = testingDays.find(day => day.id === activeTestingResultDay.id) || activeTestingResultDay;
    renderTestingResultEntry();
  } catch (error) {
    console.error(error);
    showTestingMessage(error.message || "Could not save testing results.", true);
    button.textContent = "Try Again";
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = originalLabel;
    }, 900);
  }
}

function renderTestingDayList() {
  const list = document.getElementById("testing-day-list");
  if (!list) return;
  const search = document.getElementById("testing-day-search")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("testing-status-filter")?.value || "all";
  const days = testingDays.filter(day => {
    const tests = (day.testing_day_tests || []).map(test => test.name).join(" ");
    const groups = (day.testing_day_groups || []).map(row => testingGroups.find(group => group.id === row.group_id)?.name || "").join(" ");
    const members = (day.testing_day_participants || []).map(testingParticipantName).join(" ");
    const date = `${day.testing_date} ${formatTestingDate(day.testing_date)}`;
    return (status === "all" || day.status === status) && (!search || `${day.name} ${day.description || ""} ${date} ${groups} ${members} ${tests}`.toLowerCase().includes(search));
  });

  if (!days.length) {
    list.innerHTML = `<div class="empty-state">No matching Testing Days yet.</div>`;
    return;
  }

  list.innerHTML = days.map(day => {
    const tests = (day.testing_day_tests || []).sort((a, b) => a.test_order - b.test_order);
    const canEdit = ["draft", "scheduled"].includes(day.status);
    const canDelete = ["draft", "cancelled"].includes(day.status);
    const totalOutcomes = tests.length * (day.testing_day_participants?.length || 0);
    const absentCount = (day.testing_day_participants || []).filter(participant => participant.participation_status === "did_not_participate").length;
    const savedOutcomes = tests.reduce((total, test) => total + (test.testing_results?.length || 0), 0) + (absentCount * tests.length);
    const expanded = expandedTestingDayIds.has(day.id);
    return `
      <article class="testing-day-card" data-testing-day-card="${window.RipCityUI.attr(day.id)}">
        <div class="testing-day-card-header">
          <div><p class="eyebrow">${window.RipCityUI.text(formatTestingDate(day.testing_date))}</p><h4>${window.RipCityUI.text(day.name)}</h4></div>
          <div class="testing-day-card-header-actions"><span class="testing-status status-${window.RipCityUI.attr(day.status)}">${window.RipCityUI.text(day.status)}</span><button class="outline-btn small-inline-btn" type="button" data-testing-action="toggle" aria-expanded="${expanded}">${expanded ? "Hide −" : "Review +"}</button></div>
        </div>
        <div class="testing-day-card-details ${expanded ? "" : "hidden"}">
          ${day.description ? `<p>${window.RipCityUI.text(day.description)}</p>` : ""}
          <div class="testing-day-meta"><span>${day.testing_day_participants?.length || 0} participants</span><span>·</span><span>${tests.length} tests</span><span>·</span><span>Created by ${window.RipCityUI.text(normalizeJoinedOne(day.creator)?.full_name || "facility staff")}</span></div>
          ${["scheduled", "completed"].includes(day.status) ? `<p class="testing-completion-summary">${savedOutcomes}/${totalOutcomes} outcomes accounted for${absentCount ? ` · ${absentCount} absent` : ""}</p>` : ""}
          <div class="testing-day-test-chips">${tests.map(test => `<span>${window.RipCityUI.text(test.name)}${test.unit ? ` · ${window.RipCityUI.text(test.unit)}` : ""}</span>`).join("")}</div>
          <div class="testing-day-card-actions">
          ${day.status === "scheduled" ? `<button class="primary-btn small-inline-btn" type="button" data-testing-action="edit-results">Enter Results</button>` : ""}
          ${day.status === "completed" ? `<button class="primary-btn small-inline-btn" type="button" data-testing-action="view-results">View Results</button><button class="outline-btn small-inline-btn" type="button" data-testing-action="edit-results">Edit Results</button>` : ""}
          ${day.status === "scheduled" ? `<button class="primary-btn small-inline-btn testing-finish-btn" type="button" data-testing-action="finish">Finish Testing Day</button>` : ""}
          ${canEdit ? `<button class="outline-btn small-inline-btn" type="button" data-testing-action="edit">Edit</button>` : ""}
          ${day.status === "draft" ? `<button class="primary-btn small-inline-btn" type="button" data-testing-action="schedule">Schedule</button>` : ""}
          ${day.status === "scheduled" ? `<button class="outline-btn small-inline-btn danger-btn" type="button" data-testing-action="cancel">Cancel Day</button>` : ""}
          ${day.status === "cancelled" ? `<button class="outline-btn small-inline-btn" type="button" data-testing-action="reopen">Return to Draft</button>` : ""}
          ${canDelete ? `<button class="outline-btn small-inline-btn danger-btn" type="button" data-testing-action="delete">Delete</button>` : ""}
          </div>
        </div>
        <p class="testing-day-card-feedback hidden" data-testing-day-feedback aria-live="polite"></p>
      </article>
    `;
  }).join("");
}

async function handleTestingDayAction(button) {
  const card = button.closest("[data-testing-day-card]");
  const day = testingDays.find(item => item.id === card?.dataset.testingDayCard);
  if (!day) return;
  const action = button.dataset.testingAction;
  const cardFeedback = card.querySelector("[data-testing-day-feedback]");
  if (cardFeedback) {
    cardFeedback.textContent = "";
    cardFeedback.classList.add("hidden");
    cardFeedback.classList.remove("error-message");
  }

  if (action === "toggle") {
    if (expandedTestingDayIds.has(day.id)) expandedTestingDayIds.delete(day.id);
    else expandedTestingDayIds.add(day.id);
    renderTestingDayList();
    return;
  }

  if (action === "edit") {
    fillTestingEditor(day);
    return;
  }
  if (["view-results", "edit-results"].includes(action)) {
    try { await openTestingResults(day, { readOnly: action === "view-results" }); }
    catch (error) { console.error(error); showTestingMessage(error.message || "Could not load Testing Day results.", true); }
    return;
  }

  try {
    button.disabled = true;
    if (action === "finish") button.textContent = "Finishing...";
    if (action === "delete") {
      if (!window.confirm(`Delete ${day.name}? This is allowed only because it has no saved results.`)) return;
      const { error } = await db.rpc("delete_testing_day", { p_testing_day_id: day.id });
      if (error) throw error;
      showTestingMessage("Testing Day deleted.");
    } else if (action === "finish") {
      if (!window.confirm(`Finish ${day.name}? Members will see their final recorded and Not Tested results.`)) return;
      const { error } = await db.rpc("finish_testing_day", { p_testing_day_id: day.id });
      if (error) throw error;
      showTestingMessage("Testing Day finished. Official results are available to each participant.");
    } else {
      const nextStatus = action === "schedule" ? "scheduled" : action === "cancel" ? "cancelled" : "draft";
      if (nextStatus === "scheduled" && !window.confirm(`Schedule ${day.name}?`)) return;
      if (nextStatus === "cancelled" && !window.confirm(`Cancel ${day.name}? Saved results will remain available to staff.`)) return;
      const { error } = await db.rpc("set_testing_day_status", {
        p_testing_day_id: day.id,
        p_status: nextStatus
      });
      if (error) throw error;
      showTestingMessage(nextStatus === "scheduled" ? "Testing Day scheduled." : nextStatus === "cancelled" ? "Testing Day cancelled." : "Testing Day returned to drafts.");
    }
    await loadTestingDays();
  } catch (error) {
    console.error(error);
    const rawMessage = error.message || "Could not update the Testing Day.";
    const message = action === "finish" && /Record a result, mark Not Tested, or mark the athlete absent/i.test(rawMessage)
      ? 'Finish every outcome first: enter a result, check "Did not complete" for a skipped test, or mark the athlete as not participating.'
      : rawMessage;
    if (cardFeedback) {
      cardFeedback.textContent = message;
      cardFeedback.classList.remove("hidden");
      cardFeedback.classList.add("error-message");
    } else {
      showTestingMessage(message, true);
    }
  } finally {
    button.disabled = false;
    if (button.isConnected && action === "finish") button.textContent = "Finish Testing Day";
  }
}

async function updateTestingParticipantStatus(button) {
  if (!activeTestingResultDay) return;
  const participantId = button.dataset.participantId;
  const nextStatus = button.dataset.nextStatus;
  const participant = activeTestingResultDay.testing_day_participants?.find(row => row.id === participantId);
  if (!participant) return;
  if (nextStatus === "did_not_participate" && !window.confirm(`Mark ${testingParticipantName(participant)} as not participating? Any saved results for this athlete will be cleared.`)) return;
  try {
    button.disabled = true;
    const { error } = await db.rpc("set_testing_participant_status", {
      p_testing_day_participant_id: participantId,
      p_status: nextStatus
    });
    if (error) throw error;
    participant.participation_status = nextStatus;
    if (nextStatus === "did_not_participate") {
      [...testingResultDrafts.keys()].filter(key => key.endsWith(`|${participantId}`)).forEach(key => testingResultDrafts.delete(key));
    }
    showTestingMessage(nextStatus === "did_not_participate" ? "Athlete marked as not participating." : "Athlete restored to the Testing Day.");
    await loadTestingDays();
    activeTestingResultDay = testingDays.find(day => day.id === activeTestingResultDay.id) || activeTestingResultDay;
    renderTestingResultEntry();
  } catch (error) {
    console.error(error);
    showTestingMessage(error.message || "Could not update participant status.", true);
  } finally {
    button.disabled = false;
  }
}

async function initializeCoachTesting() {
  try {
    testingAccess = await window.RipCityAccess.requireCoachAccess({ onDeniedMessage: showTestingMessage });
    if (!testingAccess) return;
    await Promise.all([loadTestingFoundation(), loadTestingDays()]);
    resetTestingEditor({ open: true });
    const params = new URLSearchParams(window.location.search);
    const linkedDay = testingDays.find(day => day.id === params.get("testingDay"));
    if (linkedDay) {
      expandedTestingDayIds.add(linkedDay.id);
      renderTestingDayList();
      await openTestingResults(linkedDay, {
        readOnly: linkedDay.status === "completed",
        memberProfileId: params.get("member")
      });
    }
  } catch (error) {
    console.error(error);
    const migrationMissing = error.code === "42P01" || /testing_days|save_testing_day/i.test(error.message || "");
    showTestingMessage(migrationMissing ? "Testing Days are ready in code, but the Testing Day migration must be applied to this Supabase environment." : (error.message || "Could not load Testing Days."), true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("testing-day-form")?.addEventListener("submit", saveTestingDay);
  document.getElementById("new-testing-day-btn")?.addEventListener("click", () => resetTestingEditor({ open: true }));
  document.getElementById("add-testing-test-btn")?.addEventListener("click", () => { testingTests.push(makeTest()); renderTestingTests(); });
  document.getElementById("testing-test-list")?.addEventListener("input", event => {
    if (event.target.matches("[data-test-field]")) updateTestFromField(event.target);
  });
  document.getElementById("testing-test-list")?.addEventListener("change", event => {
    if (event.target.matches("[data-test-field]")) updateTestFromField(event.target);
  });
  document.getElementById("testing-test-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-test-action]");
    if (button) handleTestAction(button);
  });
  document.getElementById("testing-test-list")?.addEventListener("dragstart", handleTestingTestDragStart);
  document.getElementById("testing-test-list")?.addEventListener("dragover", handleTestingTestDragOver);
  document.getElementById("testing-test-list")?.addEventListener("drop", handleTestingTestDrop);
  document.getElementById("testing-test-list")?.addEventListener("dragend", clearTestingDragState);
  document.getElementById("testing-day-form")?.addEventListener("click", event => {
    const toggle = event.target.closest("[data-testing-step-toggle]");
    const next = event.target.closest("[data-testing-step-next]");
    if (toggle) {
      const step = toggle.closest("[data-testing-step]");
      setOpenTestingStep(step.classList.contains("is-collapsed") ? step.dataset.testingStep : "");
    }
    if (next) setOpenTestingStep(next.dataset.testingStepNext);
  });
  document.getElementById("testing-group-list")?.addEventListener("change", event => {
    if (!event.target.matches("[data-testing-group]")) return;
    if (event.target.checked) selectedTestingGroupIds.add(event.target.value);
    else selectedTestingGroupIds.delete(event.target.value);
    updateTestingRosterSummary();
  });
  document.getElementById("testing-member-list")?.addEventListener("change", event => {
    if (!event.target.matches("[data-testing-member]")) return;
    if (event.target.checked) selectedTestingMemberIds.add(event.target.value);
    else selectedTestingMemberIds.delete(event.target.value);
    updateTestingRosterSummary();
  });
  document.getElementById("testing-member-search")?.addEventListener("input", () => renderTestingMembers());
  document.getElementById("testing-target-type")?.addEventListener("change", event => {
    if (event.target.value === "groups") selectedTestingMemberIds.clear();
    if (event.target.value === "members") selectedTestingGroupIds.clear();
    renderTestingGroups();
    renderTestingMembers();
    updateTestingTargetFields();
    updateTestingRosterSummary();
  });
  ["testing-day-name", "testing-day-description", "testing-day-date"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderTestingBuilderReview);
  });
  document.getElementById("testing-day-search")?.addEventListener("input", renderTestingDayList);
  document.getElementById("testing-status-filter")?.addEventListener("change", renderTestingDayList);
  document.getElementById("testing-day-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-testing-action]");
    if (button) handleTestingDayAction(button);
  });
  document.getElementById("refresh-testing-days-btn")?.addEventListener("click", async () => {
    try { await loadTestingDays(); showTestingMessage(""); }
    catch (error) { showTestingMessage(error.message || "Could not refresh Testing Days.", true); }
  });
  document.querySelector(".testing-result-mode")?.addEventListener("click", event => {
    const button = event.target.closest("[data-result-mode]");
    if (!button) return;
    testingResultMode = button.dataset.resultMode;
    testingResultFocusId = null;
    renderTestingResultEntry();
  });
  document.getElementById("testing-result-focus-select")?.addEventListener("change", event => {
    testingResultFocusId = event.target.value;
    renderTestingResultEntry();
  });
  document.getElementById("testing-result-grid")?.addEventListener("input", event => {
    if (!event.target.matches("[data-result-not-tested]")) updateTestingResultDraft(event.target);
  });
  document.getElementById("testing-result-grid")?.addEventListener("change", event => {
    if (event.target.matches("[data-result-not-tested]")) updateTestingResultDraft(event.target);
  });
  document.getElementById("save-testing-results-btn")?.addEventListener("click", saveVisibleTestingResults);
  document.getElementById("testing-participant-status-btn")?.addEventListener("click", event => updateTestingParticipantStatus(event.currentTarget));
  document.getElementById("close-testing-results-btn")?.addEventListener("click", closeTestingResults);
  document.getElementById("edit-testing-results-btn")?.addEventListener("click", () => {
    if (!activeTestingResultDay) return;
    testingResultsReadOnly = false;
    document.getElementById("testing-results-subtitle").textContent = `${formatTestingDate(activeTestingResultDay.testing_date)} · Update results by athlete or by test.`;
    document.getElementById("edit-testing-results-btn")?.classList.add("hidden");
    document.getElementById("testing-results-save-actions")?.classList.remove("hidden");
    document.getElementById("testing-results-panel")?.classList.remove("is-reviewing");
    document.querySelector('[data-result-mode="test"]').textContent = "By Test";
    renderTestingResultEntry();
  });
  document.getElementById("testing-logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "login.html";
  });

  initializeCoachTesting();
});
