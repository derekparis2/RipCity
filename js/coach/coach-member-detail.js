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

function formatGoalDateRange(goal) {
  const startDate = formatGoalTimestamp(goal.created_at);
  const endDate = goal.status === "completed" && goal.completed_at
    ? formatGoalTimestamp(goal.completed_at)
    : formatGoalDate(goal.due_date);
  return `${startDate} – ${endDate}`;
}

function getGoalProgress(goal) {
  const checkins = detailCheckinsByGoalId[goal.id] || [];
  const values = window.RipCityGoalProgress.getGoalValues(goal, checkins);
  const { currentValue, startValue, targetValue } = values;

  if (goal.status === "completed") {
    return { percent: 100, tone: "good", label: "Completed", ...values };
  }

  // Progress is measured from the starting value to the target, not from zero.
  if (currentValue === null || startValue === null || targetValue === null || targetValue === startValue) {
    return { percent: null, tone: "warning", label: "Not set", ...values };
  }

  const rawPercent = ((currentValue - startValue) / (targetValue - startValue)) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
  const tone = percent >= 80 ? "good" : percent >= 40 ? "warning" : "danger";
  return { percent, tone, label: `${percent}%`, ...values };
}

function showDetailMessage(message, isError = false) {
  const element = document.getElementById("coach-member-detail-message");
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function getSafeImageUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:", "blob:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function renderDetailMember() {
  const profile = detailMember.member_profile?.[0] || detailMember.member_profile || {};
  const groups = (detailMember.group_members || []).map(item => item.group?.name).filter(Boolean);
  const safeProfilePictureUrl = getSafeImageUrl(detailMember.profile?.profile_picture_url);
  const formatMemberBirthday = birthday => birthday
    ? new Date(`${birthday}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
    : "";
  const profileDetails = [
    ["Username", detailMember.profile?.username ? `@${detailMember.profile.username}` : ""],
    ["Birthday", formatMemberBirthday(detailMember.profile?.birthday)],
    ["Sport", profile.sport],
    ["Position", profile.position],
    ["School", profile.school],
    ["Graduation year", profile.graduation_year],
    ["Height", profile.height],
    ["Body weight", profile.body_weight],
    ["Training focus", profile.training_focus],
    ["Favorite lift", profile.favorite_lift]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  document.getElementById("coach-member-detail-summary").innerHTML = `
    <div class="coach-member-detail-heading">
      ${window.RipCityUI.avatarMarkup(detailMember.profile?.full_name, safeProfilePictureUrl, "roster-avatar")}
      <div><p class="eyebrow">${window.RipCityUI.text(profile.member_type === "h2k" ? "H2K MEMBER" : "ATHLETE")}</p><h2>${window.RipCityUI.text(detailMember.profile?.full_name, "Unnamed Member")}</h2><p>${window.RipCityUI.text(detailMember.profile?.email)}</p></div>
    </div>
    <div class="member-goal-meta"><span>${window.RipCityUI.text(groups.join(", ") || "No groups")}</span>${profile.h2k_band_color ? `<span>${window.RipCityUI.text(`${profile.h2k_band_color} Band`)}</span>` : ""}</div>
    ${detailMember.profile?.bio ? `<p>${window.RipCityUI.text(detailMember.profile.bio)}</p>` : ""}
    ${profileDetails.length ? `<p class="eyebrow">PROFILE DETAILS</p><div class="profile-detail-list">${profileDetails.map(([label, value]) => `<div><span>${window.RipCityUI.text(label)}</span><strong>${window.RipCityUI.text(value)}</strong></div>`).join("")}</div>` : `<p class="empty-state">This member has not added profile details yet.</p>`}`;
}

function renderDetailGoals() {
  const list = document.getElementById("coach-goal-list");
  if (!list) return;

  const activeGoals = detailGoals.filter(goal => goal.status === "active");
  const pausedGoals = detailGoals.filter(goal => goal.status === "paused");
  const completedGoals = detailGoals.filter(goal => goal.status === "completed");
  const renderGoal = goal => {
    const progress = getGoalProgress(goal);
    const checkins = detailCheckinsByGoalId[goal.id] || [];
    const valueSummary = window.RipCityGoalProgress.formatGoalValueSummary(goal, checkins);
    const displayValue = value => value === null ? "—" : value;
    const goalDateText = formatGoalDateRange(goal);

    return `
    <article class="member-goal-card ${goal.status === "paused" ? "is-paused" : ""}">
      <details class="member-goal-disclosure" data-coach-goal-disclosure>
        <summary class="member-goal-summary">
          <div class="member-goal-summary-copy">
            <div class="member-goal-card-heading">
              <h4>${window.RipCityUI.text(goal.name)}</h4>
              <div class="member-goal-summary-badges">
                <span class="status-pill">${window.RipCityUI.text(goal.source === "member" ? "Member goal" : "Coach goal")}</span>
                <span class="status-pill goal-status-pill is-${window.RipCityUI.attr(goal.status)}">${window.RipCityUI.text(goal.status[0].toUpperCase() + goal.status.slice(1))}</span>
              </div>
            </div>
            <div class="member-goal-meta">
              <span>${window.RipCityUI.text(valueSummary)}</span>
              <span>${window.RipCityUI.text(formatGoalTimeline(goal.timeline))}</span>
              <span>${window.RipCityUI.text(goalDateText)}</span>
            </div>
          </div>
          <span class="member-goal-summary-action" aria-hidden="true"></span>
        </summary>
        <div class="member-goal-expanded">
          ${goal.description ? `<p>${window.RipCityUI.text(goal.description)}</p>` : ""}
          <div class="coach-goal-progress" aria-label="Goal progress: ${progress.label}">
            <div class="coach-goal-progress-heading"><span>Progress</span><strong class="status-${progress.tone}">${progress.label}</strong></div>
            <div class="progress-bar"><div class="status-${progress.tone}" style="width: ${progress.percent ?? 0}%"></div></div>
            ${progress.targetValue === null ? "" : `<div class="coach-goal-progress-scale">
              <span>Start ${displayValue(progress.startValue)}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</span>
              <span>${progress.currentLabel} ${displayValue(progress.currentValue)}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</span>
              <span>Target ${progress.targetValue}${goal.unit ? ` ${window.RipCityUI.text(goal.unit)}` : ""}</span>
            </div>`}
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
        </div>
      </details>
    </article>`;
  };

  const renderActiveSection = goals => goals.length
    ? `<section class="coach-goal-section"><div class="coach-goal-section-heading"><h3>Active goals</h3><span>${goals.length}</span></div><div class="member-goal-list">${goals.map(renderGoal).join("")}</div></section>`
    : "";
  const renderCollapsedSection = (title, goals) => goals.length
    ? `<details class="member-goal-achievements coach-goal-section"><summary>${title}<span>${goals.length}</span></summary><div class="member-goal-list">${goals.map(renderGoal).join("")}</div></details>`
    : "";

  list.innerHTML = activeGoals.length || pausedGoals.length || completedGoals.length
    ? `${renderActiveSection(activeGoals)}${renderCollapsedSection("Paused goals", pausedGoals)}${renderCollapsedSection("Completed goals", completedGoals)}`
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

function formatGoalTimestamp(timestamp) {
  if (!timestamp) return "Unknown date";

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function resetCoachGoalForm() {
  document.getElementById("coach-goal-form")?.reset();
  document.getElementById("coach-goal-id").value = "";
  document.getElementById("coach-goal-submit").textContent = "Assign Goal";
  document.getElementById("coach-goal-cancel").classList.add("hidden");
  const editor = document.getElementById("coach-goal-editor");
  if (editor) editor.open = !window.matchMedia("(max-width: 700px)").matches;
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
  document.getElementById("coach-goal-editor").open = true;
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
    profile:profiles!facility_members_profile_id_fkey (id, full_name, email, profile_picture_url, username, bio, birthday),
    member_profile:member_profiles (id, member_type, h2k_band_color, sport, position, school, graduation_year, height, body_weight, training_focus, favorite_lift)
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
  await Promise.all([
    loadDetailGoals(),
    window.RipCityCoachMemberHistory.init({
      access: detailAccess,
      member: detailMember
    })
  ]);
}

async function init() {
  try {
    detailAccess = await window.RipCityAccess.requireCoachAccess();

    if (!detailAccess) return;

    await loadMember();
  } catch (error) {
    showDetailMessage(error.message || "Could not load member.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("coach-member-detail-logout").addEventListener("click", async () => { await db.auth.signOut(); window.location.href = "login.html"; });
  document.getElementById("coach-goal-form").addEventListener("submit", saveCoachGoal);
  document.getElementById("coach-goal-cancel").addEventListener("click", resetCoachGoalForm);
  resetCoachGoalForm();
  init();
});
