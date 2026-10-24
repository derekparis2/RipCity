// =====================================================
// COACH TESTING DAYS
// =====================================================
// Testing Days snapshot a deduplicated roster and ordered test definitions.
// Result-entry controls intentionally remain unavailable until Rip City chooses
// whether coaches, admins, members, or a verified combination may submit them.

let testingAccess = null;
let testingGroups = [];
let testingMembers = [];
let testingGroupMemberships = [];
let testingDays = [];
let testingTests = [];
let testingTemplates = [];
let selectedTestingGroupIds = new Set();
let selectedTestingMemberIds = new Set();

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
    <label class="testing-choice">
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
      <label class="testing-choice">
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
  if (count) count.textContent = `${members.length} selected`;
  if (!roster) return;
  roster.innerHTML = members.length
    ? members.map(member => `<span class="testing-roster-chip">${window.RipCityUI.text(member.name)}</span>`).join("")
    : `<span class="muted-small">No participants selected yet.</span>`;
}

function makeTest(definition = {}) {
  return {
    key: definition.key || crypto.randomUUID(),
    name: definition.name || "",
    description: definition.description || "",
    unit: definition.unit || "",
    inputType: definition.inputType || definition.input_type || "number",
    rankingDirection: definition.rankingDirection || definition.ranking_direction || "higher"
  };
}

function renderTestingTests() {
  const list = document.getElementById("testing-test-list");
  if (!list) return;

  if (!testingTests.length) {
    list.innerHTML = `<div class="empty-state">Add at least one test to build the day.</div>`;
    return;
  }

  list.innerHTML = testingTests.map((test, index) => `
    <article class="testing-test-row" data-testing-test="${window.RipCityUI.attr(test.key)}">
      <span class="testing-test-order">${index + 1}</span>
      <label>Test Name<input data-test-field="name" list="testing-test-suggestions" value="${window.RipCityUI.attr(test.name)}" placeholder="10-Yard Sprint" required /></label>
      <label>Unit<input data-test-field="unit" value="${window.RipCityUI.attr(test.unit)}" placeholder="seconds, inches, mph..." /></label>
      <label>Input<select data-test-field="inputType"><option value="number" ${test.inputType === "number" ? "selected" : ""}>Number</option><option value="time" ${test.inputType === "time" ? "selected" : ""}>Time</option><option value="text" ${test.inputType === "text" ? "selected" : ""}>Text</option></select></label>
      <label>Ranking<select data-test-field="rankingDirection"><option value="higher" ${test.rankingDirection === "higher" ? "selected" : ""}>Higher is better</option><option value="lower" ${test.rankingDirection === "lower" ? "selected" : ""}>Lower is better</option><option value="none" ${test.rankingDirection === "none" ? "selected" : ""}>Do not rank</option></select></label>
      <div class="testing-test-actions">
        <button class="testing-icon-btn" type="button" data-test-action="up" aria-label="Move test up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="testing-icon-btn" type="button" data-test-action="down" aria-label="Move test down" ${index === testingTests.length - 1 ? "disabled" : ""}>↓</button>
        <button class="testing-icon-btn danger" type="button" data-test-action="remove" aria-label="Remove test">×</button>
      </div>
    </article>
  `).join("");
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
  }
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

function resetTestingEditor({ open = true } = {}) {
  document.getElementById("testing-day-form")?.reset();
  document.getElementById("testing-day-id").value = "";
  document.getElementById("testing-day-date").value = localDateKey();
  document.getElementById("testing-editor-title").textContent = "New Testing Day";
  selectedTestingGroupIds = new Set();
  selectedTestingMemberIds = new Set();
  renderTestingGroups();
  renderTestingMembers();
  testingTests = [makeTest(TEST_PRESETS["10-Yard Sprint"] ? { name: "10-Yard Sprint", ...TEST_PRESETS["10-Yard Sprint"] } : {})];
  renderTestingTests();
  updateTestingRosterSummary();
  document.getElementById("testing-editor")?.classList.toggle("hidden", !open);
  if (open) document.getElementById("testing-day-name")?.focus();
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
  renderTestingGroups();
  renderTestingMembers();
  testingTests = (day.testing_day_tests || [])
    .sort((a, b) => a.test_order - b.test_order)
    .map(test => makeTest(test));
  renderTestingTests();
  updateTestingRosterSummary();
  document.getElementById("testing-editor")?.classList.remove("hidden");
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
    resetTestingEditor({ open: false });
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
      testing_day_tests(id,name,description,unit,input_type,ranking_direction,test_order),
      testing_day_groups(group_id),
      testing_day_participants(id,member_profile_id,selected_individually)
    `)
    .eq("facility_id", testingAccess.facilityId)
    .order("testing_date", { ascending: false });

  if (error) throw error;
  testingDays = data || [];
  renderTestingDayList();
}

function renderTestingDayList() {
  const list = document.getElementById("testing-day-list");
  if (!list) return;
  const search = document.getElementById("testing-day-search")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("testing-status-filter")?.value || "all";
  const days = testingDays.filter(day => {
    const tests = (day.testing_day_tests || []).map(test => test.name).join(" ");
    return (status === "all" || day.status === status) && (!search || `${day.name} ${day.description || ""} ${tests}`.toLowerCase().includes(search));
  });

  if (!days.length) {
    list.innerHTML = `<div class="empty-state">No matching Testing Days yet.</div>`;
    return;
  }

  list.innerHTML = days.map(day => {
    const tests = (day.testing_day_tests || []).sort((a, b) => a.test_order - b.test_order);
    const canEdit = ["draft", "scheduled"].includes(day.status);
    const canDelete = ["draft", "cancelled"].includes(day.status);
    return `
      <article class="testing-day-card" data-testing-day-card="${window.RipCityUI.attr(day.id)}">
        <div class="testing-day-card-header">
          <div><p class="eyebrow">${window.RipCityUI.text(formatTestingDate(day.testing_date))}</p><h4>${window.RipCityUI.text(day.name)}</h4></div>
          <span class="testing-status status-${window.RipCityUI.attr(day.status)}">${window.RipCityUI.text(day.status)}</span>
        </div>
        ${day.description ? `<p>${window.RipCityUI.text(day.description)}</p>` : ""}
        <div class="testing-day-meta"><span>${day.testing_day_participants?.length || 0} participants</span><span>·</span><span>${tests.length} tests</span><span>·</span><span>Created by ${window.RipCityUI.text(normalizeJoinedOne(day.creator)?.full_name || "facility staff")}</span></div>
        <div class="testing-day-test-chips">${tests.map(test => `<span>${window.RipCityUI.text(test.name)}${test.unit ? ` · ${window.RipCityUI.text(test.unit)}` : ""}</span>`).join("")}</div>
        <div class="testing-result-decision"><strong>Result entry is not enabled yet.</strong> The roster and test battery are ready; submission access will be added after Rip City decides who enters official results.</div>
        <div class="testing-day-card-actions">
          ${canEdit ? `<button class="outline-btn small-inline-btn" type="button" data-testing-action="edit">Edit</button>` : ""}
          ${day.status === "draft" ? `<button class="primary-btn small-inline-btn" type="button" data-testing-action="schedule">Schedule</button>` : ""}
          ${day.status === "scheduled" ? `<button class="outline-btn small-inline-btn" type="button" data-testing-action="cancel">Cancel Day</button>` : ""}
          ${day.status === "cancelled" ? `<button class="outline-btn small-inline-btn" type="button" data-testing-action="reopen">Return to Draft</button>` : ""}
          ${canDelete ? `<button class="outline-btn small-inline-btn danger-btn" type="button" data-testing-action="delete">Delete</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function handleTestingDayAction(button) {
  const card = button.closest("[data-testing-day-card]");
  const day = testingDays.find(item => item.id === card?.dataset.testingDayCard);
  if (!day) return;
  const action = button.dataset.testingAction;

  if (action === "edit") {
    fillTestingEditor(day);
    return;
  }

  try {
    button.disabled = true;
    if (action === "delete") {
      if (!window.confirm(`Delete ${day.name}? This is allowed only because it has no saved results.`)) return;
      const { error } = await db.rpc("delete_testing_day", { p_testing_day_id: day.id });
      if (error) throw error;
      showTestingMessage("Testing Day deleted.");
    } else {
      const nextStatus = action === "schedule" ? "scheduled" : action === "cancel" ? "cancelled" : "draft";
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
    showTestingMessage(error.message || "Could not update the Testing Day.", true);
  } finally {
    button.disabled = false;
  }
}

async function initializeCoachTesting() {
  try {
    testingAccess = await window.RipCityAccess.requireCoachAccess({ onDeniedMessage: showTestingMessage });
    if (!testingAccess) return;
    await Promise.all([loadTestingFoundation(), loadTestingDays()]);
    resetTestingEditor({ open: false });
  } catch (error) {
    console.error(error);
    const migrationMissing = error.code === "42P01" || /testing_days|save_testing_day/i.test(error.message || "");
    showTestingMessage(migrationMissing ? "Testing Days are ready in code, but the Testing Day migration must be applied to this Supabase environment." : (error.message || "Could not load Testing Days."), true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("testing-day-form")?.addEventListener("submit", saveTestingDay);
  document.getElementById("new-testing-day-btn")?.addEventListener("click", () => resetTestingEditor({ open: true }));
  document.getElementById("close-testing-editor-btn")?.addEventListener("click", () => resetTestingEditor({ open: false }));
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
  document.getElementById("testing-day-search")?.addEventListener("input", renderTestingDayList);
  document.getElementById("testing-status-filter")?.addEventListener("change", renderTestingDayList);
  document.getElementById("testing-day-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-testing-action]");
    if (button) handleTestingDayAction(button);
  });
  document.getElementById("refresh-testing-days-btn")?.addEventListener("click", async () => {
    try { await loadTestingDays(); showTestingMessage("Testing Days refreshed."); }
    catch (error) { showTestingMessage(error.message || "Could not refresh Testing Days.", true); }
  });
  document.getElementById("testing-logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "login.html";
  });

  initializeCoachTesting();
});
