let detailAccess = null;
let detailMember = null;
let detailGoals = [];
let detailCheckinsByGoalId = {};

function normalizeGoalNumber(value) {
  return value === "" ? null : Number(value);
}

function formatGoalDate(dateKey) {
  if (!dateKey) return "No due date";

  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatGoalTimeline(timeline) {
  return {
    short_term: "Short term",
    medium_term: "Medium term",
    long_term: "Long term",
    ongoing: "Ongoing"
  }[timeline] || "Short term";
}

function getGoalProgress(goal) {
  if (goal.status === "completed") return { percent: 100, tone: "good", label: "100%" };

  const checkins = detailCheckinsByGoalId[goal.id] || [];
  const latestCheckin = checkins[checkins.length - 1];
  const currentValue = Number(latestCheckin?.value ?? goal.current_value);
  const targetValue = Number(goal.target_value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return { percent: null, tone: "warning", label: "Not set", currentValue: null };
  }

  const percent = Math.max(0, Math.min(100, Math.round((currentValue / targetValue) * 100)));
  const tone = percent >= 80 ? "good" : percent >= 40 ? "warning" : "danger";
  return { percent, tone, label: `${percent}%`, currentValue };
}

function showDetailMessage(message, isError = false) {
  const element = document.getElementById("coach-member-detail-message");
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function renderDetailMember() {
  const profile = detailMember.member_profile?.[0] || detailMember.member_profile || {};
  const groups = (detailMember.group_members || []).map(item => item.group?.name).filter(Boolean);
  document.getElementById("coach-member-detail-summary").innerHTML = `
    <div class="coach-member-detail-heading">
      ${window.RipCityUI.avatarMarkup(detailMember.profile?.full_name, detailMember.profile?.profile_picture_url, "roster-avatar")}
      <div><p class="eyebrow">${window.RipCityUI.text(profile.member_type === "h2k" ? "H2K MEMBER" : "ATHLETE")}</p><h2>${window.RipCityUI.text(detailMember.profile?.full_name, "Unnamed Member")}</h2><p>${window.RipCityUI.text(detailMember.profile?.email)}</p></div>
    </div>
    <div class="member-goal-meta"><span>${window.RipCityUI.text(groups.join(", ") || "No groups")}</span>${profile.h2k_band_color ? `<span>${window.RipCityUI.text(`${profile.h2k_band_color} Band`)}</span>` : ""}</div>`;
}

function renderDetailGoals() {
  const list = document.getElementById("coach-goal-list");
  if (!list) return;

  const assignedGoals = detailGoals.filter(goal => goal.status !== "completed" && goal.source === "coach");
  const createdGoals = detailGoals.filter(goal => goal.status !== "completed" && goal.source === "member");
  const completedGoals = detailGoals.filter(goal => goal.status === "completed");
  const renderGoal = goal => {
    const progress = getGoalProgress(goal);
    const displayedCurrentValue = progress.currentValue ?? goal.current_value;

    return `
    <article class="member-goal-card ${goal.status === "paused" ? "is-paused" : ""}">
      <div class="member-goal-card-main">
        <div class="member-goal-card-heading">
          <h4>${window.RipCityUI.text(goal.name)}</h4>
          <span class="status-pill">${window.RipCityUI.text(goal.source === "member" ? "Member goal" : "Coach goal")}</span>
        </div>
        ${goal.description ? `<p>${window.RipCityUI.text(goal.description)}</p>` : ""}
        <div class="member-goal-meta">
          <span>${window.RipCityUI.text(formatGoalTimeline(goal.timeline))}</span>
          <span>${window.RipCityUI.text(goal.target_value === null ? "No target value" : `${displayedCurrentValue ?? 0} / ${goal.target_value}${goal.unit ? ` ${goal.unit}` : ""}`)}</span>
          <span>${window.RipCityUI.text(formatGoalDate(goal.due_date))}</span>
        </div>
        <div class="coach-goal-progress" aria-label="Goal progress: ${progress.label}">
            <div class="coach-goal-progress-heading"><span>Progress</span><strong class="status-${progress.tone}">${progress.label}</strong></div>
            <div class="progress-bar"><div class="status-${progress.tone}" style="width: ${progress.percent ?? 0}%"></div></div>
        </div>
      </div>
      <div class="member-goal-actions">
        <label>Status
          <select data-coach-goal-status="${window.RipCityUI.attr(goal.id)}">
            ${["active", "paused", "completed"].map(status => `<option value="${status}" ${goal.status === status ? "selected" : ""}>${status[0].toUpperCase() + status.slice(1)}</option>`).join("")}
          </select>
        </label>
        <button class="outline-btn" type="button" data-edit-coach-goal="${window.RipCityUI.attr(goal.id)}">Edit</button>
        <button class="outline-btn danger-outline-btn" type="button" data-delete-coach-goal="${window.RipCityUI.attr(goal.id)}">Delete</button>
      </div>
    </article>`;
  };

  const renderSection = (title, goals) => goals.length
    ? `<section class="coach-goal-section"><h3>${title}</h3><div class="member-goal-list">${goals.map(renderGoal).join("")}</div></section>`
    : "";

  list.innerHTML = assignedGoals.length || createdGoals.length || completedGoals.length
    ? `${renderSection("Assigned goals", assignedGoals)}${renderSection("Created goals", createdGoals)}${renderSection("Completed goals", completedGoals)}`
    : `<div class="empty-state">No goals assigned yet.</div>`;

  document.querySelectorAll("[data-coach-goal-status]").forEach(select => {
    select.addEventListener("change", () => updateCoachGoalStatus(select.dataset.coachGoalStatus, select.value));
  });
  document.querySelectorAll("[data-edit-coach-goal]").forEach(button => {
    button.addEventListener("click", () => startCoachGoalEdit(button.dataset.editCoachGoal));
  });
  document.querySelectorAll("[data-delete-coach-goal]").forEach(button => {
    button.addEventListener("click", () => deleteCoachGoal(button.dataset.deleteCoachGoal));
  });
}

function resetCoachGoalForm() {
  document.getElementById("coach-goal-form")?.reset();
  document.getElementById("coach-goal-id").value = "";
  document.getElementById("coach-goal-submit").textContent = "Assign Goal";
  document.getElementById("coach-goal-cancel").classList.add("hidden");
}

function startCoachGoalEdit(goalId) {
  const goal = detailGoals.find(item => item.id === goalId);
  if (!goal) return;

  document.getElementById("coach-goal-id").value = goal.id;
  document.getElementById("coach-goal-name").value = goal.name;
  document.getElementById("coach-goal-timeline").value = goal.timeline;
  document.getElementById("coach-goal-current-value").value = goal.current_value ?? "";
  document.getElementById("coach-goal-target-value").value = goal.target_value ?? "";
  document.getElementById("coach-goal-unit").value = goal.unit || "";
  document.getElementById("coach-goal-due-date").value = goal.due_date || "";
  document.getElementById("coach-goal-description").value = goal.description || "";
  document.getElementById("coach-goal-submit").textContent = "Save Goal";
  document.getElementById("coach-goal-cancel").classList.remove("hidden");
  document.getElementById("coach-goal-name").focus();
}

async function loadDetailGoals() {
  const memberProfile = detailMember.member_profile?.[0] || detailMember.member_profile;
  const { data, error } = await db.from("goals")
    .select("*")
    .eq("member_profile_id", memberProfile.id)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  detailGoals = data || [];

  const { data: checkins, error: checkinError } = await db.from("goal_checkins")
    .select("goal_id, recorded_date, value")
    .eq("member_profile_id", memberProfile.id)
    .order("recorded_date", { ascending: true });

  if (checkinError) throw checkinError;
  detailCheckinsByGoalId = {};
  (checkins || []).forEach(checkin => {
    if (!detailCheckinsByGoalId[checkin.goal_id]) detailCheckinsByGoalId[checkin.goal_id] = [];
    detailCheckinsByGoalId[checkin.goal_id].push(checkin);
  });
  renderDetailGoals();
}

async function saveCoachGoal(event) {
  event.preventDefault();
  const memberProfile = detailMember.member_profile?.[0] || detailMember.member_profile;
  const goalId = document.getElementById("coach-goal-id").value;
  const values = {
    name: document.getElementById("coach-goal-name").value.trim(),
    description: document.getElementById("coach-goal-description").value.trim() || null,
    timeline: document.getElementById("coach-goal-timeline").value,
    current_value: normalizeGoalNumber(document.getElementById("coach-goal-current-value").value),
    target_value: normalizeGoalNumber(document.getElementById("coach-goal-target-value").value),
    unit: document.getElementById("coach-goal-unit").value.trim() || null,
    due_date: document.getElementById("coach-goal-due-date").value || null
  };

  showDetailMessage(goalId ? "Saving goal..." : "Assigning goal...");
  try {
    const request = goalId
      ? db.from("goals").update(values).eq("id", goalId)
      : db.from("goals").insert({
        ...values,
        member_profile_id: memberProfile.id,
        created_by: detailAccess.session.user.id,
        source: "coach"
      });
    const { error } = await request;
    if (error) throw error;
    resetCoachGoalForm();
    await loadDetailGoals();
    showDetailMessage("");
  } catch (error) {
    console.error(error);
    showDetailMessage(error.message || "Could not save goal.", true);
  }
}

async function updateCoachGoalStatus(goalId, status) {
  showDetailMessage("Updating goal...");
  try {
    const { error } = await db.from("goals").update({ status }).eq("id", goalId);
    if (error) throw error;
    await loadDetailGoals();
    showDetailMessage("");
  } catch (error) {
    console.error(error);
    showDetailMessage(error.message || "Could not update goal status.", true);
  }
}

async function deleteCoachGoal(goalId) {
  if (!window.confirm("Delete this goal permanently? This cannot be undone.")) return;

  showDetailMessage("Deleting goal...");
  try {
    const { error } = await db.from("goals").delete().eq("id", goalId);
    if (error) throw error;
    await loadDetailGoals();
    showDetailMessage("");
  } catch (error) {
    console.error(error);
    showDetailMessage(error.message || "Could not delete goal.", true);
  }
}

async function loadMember() {
  const membershipId = new URLSearchParams(window.location.search).get("membership");
  if (!membershipId) throw new Error("Choose a member from the roster first.");

  const { data, error } = await db.from("facility_members").select(`
    id, facility_id, role, status,
    profile:profiles!facility_members_profile_id_fkey (id, full_name, email, profile_picture_url),
    member_profile:member_profiles (id, member_type, h2k_band_color)
  `).eq("id", membershipId).eq("facility_id", detailAccess.membership.facility_id).single();

  if (error) throw error;
  if (!data.member_profile) throw new Error("That account is not a member profile.");

  const memberProfile = data.member_profile?.[0] || data.member_profile;
  const { data: groupRows, error: groupError } = await db.from("group_members")
    .select("group:groups (name)")
    .eq("member_profile_id", memberProfile.id);

  if (groupError) throw groupError;

  detailMember = {
    ...data,
    group_members: groupRows || []
  };
  renderDetailMember();
  await loadDetailGoals();
}

async function init() {
  try { detailAccess = await window.RipCityAccess.requireCoachAccess(); if (!detailAccess) return; await loadMember(); } catch (error) { showDetailMessage(error.message || "Could not load member.", true); }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("coach-member-detail-logout").addEventListener("click", async () => { await db.auth.signOut(); window.location.href = "login.html"; });
  document.getElementById("coach-goal-form").addEventListener("submit", saveCoachGoal);
  document.getElementById("coach-goal-cancel").addEventListener("click", resetCoachGoalForm);
  init();
});