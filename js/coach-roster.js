// =====================================================
// COACH ROSTER
// =====================================================
// Coaches use this page to manage members and group memberships inside their
// own facility. Group membership drives group workout visibility.

let rosterAccess = null;
let rosterMembers = [];
let rosterGroups = [];
let rosterGroupMemberships = [];

function showRosterMessage(message, isError = false) {
  const element = document.getElementById("coach-roster-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function normalizeMemberProfile(member) {
  return window.RipCityWorkoutData.normalizeJoinedOne(member.member_profile);
}

function formatMemberType(memberType) {
  return memberType === "h2k" ? "H2K" : "Athlete";
}

function formatRole(role) {
  const labels = {
    athlete: "Athlete",
    h2k_member: "H2K Member",
    coach: "Coach",
    admin: "Admin",
    parent: "Parent"
  };

  return labels[role] || role;
}

function groupSupportsMember(group, memberType) {
  return group.member_type === "both" || group.member_type === memberType;
}

function getMemberGroupIds(memberProfileId) {
  return rosterGroupMemberships
    .filter(row => row.member_profile_id === memberProfileId)
    .map(row => row.group_id);
}

function getMemberGroups(memberProfileId) {
  const groupIds = new Set(getMemberGroupIds(memberProfileId));
  return rosterGroups.filter(group => groupIds.has(group.id));
}

function getCheckedGroupIds(memberProfileId) {
  return Array.from(document.querySelectorAll("[data-roster-group-toggle]"))
    .filter(input => input.dataset.memberProfileId === memberProfileId && input.checked)
    .map(input => input.dataset.groupId);
}

function sameGroupSelection(savedGroupIds, selectedGroupIds) {
  const saved = new Set(savedGroupIds);
  const selected = new Set(selectedGroupIds);

  if (saved.size !== selected.size) return false;
  return [...saved].every(groupId => selected.has(groupId));
}

function markMemberGroupChanges(memberProfileId) {
  const card = document.querySelector(`[data-roster-member-card="${memberProfileId}"]`);
  if (!card) return;

  const hasChanges = !sameGroupSelection(
    getMemberGroupIds(memberProfileId),
    getCheckedGroupIds(memberProfileId)
  );

  card.classList.toggle("has-unsaved-changes", hasChanges);
  card.querySelectorAll("[data-save-member-groups], [data-reset-member-groups]").forEach(button => {
    button.disabled = !hasChanges;
  });
}

function getFilteredMembers() {
  const typeFilter = document.getElementById("roster-type-filter").value;
  const statusFilter = document.getElementById("roster-status-filter").value;
  const groupFilter = document.getElementById("roster-group-filter").value;
  const search = document.getElementById("roster-search").value.trim().toLowerCase();

  return rosterMembers.filter(member => {
    const memberProfile = member.memberProfile;
    const groupIds = getMemberGroupIds(member.memberProfileId);
    const searchText = [
      member.name,
      member.email,
      member.role,
      member.status,
      memberProfile?.sport,
      memberProfile?.age_group,
      memberProfile?.position,
      memberProfile?.school
    ].filter(Boolean).join(" ").toLowerCase();

    if (typeFilter !== "all" && member.memberType !== typeFilter) return false;
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    if (groupFilter !== "all" && !groupIds.includes(groupFilter)) return false;
    if (search && !searchText.includes(search)) return false;

    return true;
  });
}

async function requireRosterCoachAccess() {
  return window.RipCityAccess.requireCoachAccess({
    onDeniedMessage: showRosterMessage
  });
}

async function loadRosterMembers(facilityId) {
  const { data, error } = await db
    .from("facility_members")
    .select(`
      id,
      role,
      status,
      created_at,
      profile:profiles!facility_members_profile_id_fkey (
        id,
        full_name,
        email
      ),
      member_profile:member_profiles (
        id,
        member_type,
        sport,
        age_group,
        position,
        school,
        graduation_year,
        body_weight,
        training_focus
      )
    `)
    .eq("facility_id", facilityId)
    .in("role", ["athlete", "h2k_member"])
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(member => {
    const memberProfile = normalizeMemberProfile(member);

    return {
      facilityMemberId: member.id,
      profileId: member.profile?.id,
      memberProfileId: memberProfile?.id,
      memberType: memberProfile?.member_type || (member.role === "h2k_member" ? "h2k" : "athlete"),
      role: member.role,
      status: member.status,
      name: member.profile?.full_name || "Unnamed Member",
      email: member.profile?.email || "",
      memberProfile
    };
  }).filter(member => member.memberProfileId);
}

async function loadRosterGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("*")
    .eq("facility_id", facilityId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadRosterGroupMemberships(memberProfileIds) {
  if (!memberProfileIds.length) return [];

  const { data, error } = await db
    .from("group_members")
    .select("id, group_id, member_profile_id")
    .in("member_profile_id", memberProfileIds);

  if (error) throw error;
  return data || [];
}

function updateRosterStats() {
  const ungrouped = rosterMembers.filter(member => !getMemberGroupIds(member.memberProfileId).length);

  document.getElementById("roster-total-members").textContent = rosterMembers.length;
  document.getElementById("roster-athlete-count").textContent =
    rosterMembers.filter(member => member.memberType === "athlete").length;
  document.getElementById("roster-h2k-count").textContent =
    rosterMembers.filter(member => member.memberType === "h2k").length;
  document.getElementById("roster-ungrouped-count").textContent = ungrouped.length;
}

function renderGroupFilter() {
  const select = document.getElementById("roster-group-filter");

  select.innerHTML = `
    <option value="all">All groups</option>
    ${rosterGroups.map(group => `
      <option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>
    `).join("")}
  `;
}

function renderGroupList() {
  const list = document.getElementById("roster-group-list");

  if (!rosterGroups.length) {
    list.innerHTML = `<div class="empty-state">No groups created yet.</div>`;
    return;
  }

  list.innerHTML = rosterGroups.map(group => {
    const count = rosterGroupMemberships.filter(row => row.group_id === group.id).length;

    return `
      <article class="roster-group-card">
        <div>
          <strong>${window.RipCityUI.text(group.name)}</strong>
          <span>${window.RipCityUI.text(group.group_type)} · ${window.RipCityUI.text(group.member_type)}</span>
        </div>
        <div class="roster-group-card-actions">
          <b>${count}</b>
          <button
            class="danger-btn small-inline-btn"
            type="button"
            data-delete-roster-group="${window.RipCityUI.attr(group.id)}"
          >
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-delete-roster-group]").forEach(button => {
    button.addEventListener("click", () => deleteRosterGroup(button.dataset.deleteRosterGroup));
  });
}

function renderRosterMembers() {
  const list = document.getElementById("coach-roster-list");
  const members = getFilteredMembers();

  updateRosterStats();

  if (!members.length) {
    list.innerHTML = `<div class="empty-state">No members match these filters.</div>`;
    return;
  }

  list.innerHTML = members.map(member => renderRosterMemberCard(member)).join("");

  document.querySelectorAll("[data-roster-group-toggle]").forEach(input => {
    input.addEventListener("change", () => markMemberGroupChanges(input.dataset.memberProfileId));
  });

  document.querySelectorAll("[data-toggle-group-editor]").forEach(button => {
    button.addEventListener("click", () => {
      const card = document.querySelector(`[data-roster-member-card="${button.dataset.memberProfileId}"]`);
      if (!card) return;

      card.classList.toggle("is-editing-groups");
      button.textContent = card.classList.contains("is-editing-groups") ? "Hide Groups" : "Change Groups";
    });
  });

  document.querySelectorAll("[data-save-member-groups]").forEach(button => {
    button.addEventListener("click", () => saveMemberGroupChanges(button.dataset.memberProfileId));
  });

  document.querySelectorAll("[data-reset-member-groups]").forEach(button => {
    button.addEventListener("click", () => renderRosterMembers());
  });

  document.querySelectorAll("[data-member-status-action]").forEach(button => {
    button.addEventListener("click", () => setRosterMemberStatus(
      button.dataset.facilityMemberId,
      button.dataset.nextStatus
    ));
  });
}

function renderRosterMemberCard(member) {
  const memberProfile = member.memberProfile || {};
  const memberGroups = getMemberGroups(member.memberProfileId);
  const groupIds = new Set(memberGroups.map(group => group.id));
  const compatibleGroups = rosterGroups.filter(group => groupSupportsMember(group, member.memberType));
  const meta = [
    formatRole(member.role),
    member.status,
    memberProfile.sport,
    memberProfile.age_group,
    memberProfile.position,
    memberProfile.school
  ].filter(Boolean).join(" · ");
  const nextStatus = member.status === "inactive" ? "approved" : "inactive";
  const statusActionLabel = member.status === "inactive" ? "Reactivate" : "Deactivate";

  return `
    <article class="roster-member-card" data-roster-member-card="${window.RipCityUI.attr(member.memberProfileId)}">
      <div class="roster-member-main">
        <div class="avatar roster-avatar">${window.RipCityUI.text(window.RipCityUI.safeInitials(member.name))}</div>

        <div>
          <div class="roster-member-heading">
            <h4>${window.RipCityUI.text(member.name)}</h4>
            <span class="status-pill">${window.RipCityUI.text(formatMemberType(member.memberType))}</span>
          </div>
          <p>${window.RipCityUI.text(member.email)}</p>
          <small>${window.RipCityUI.text(meta || "No profile details yet")}</small>
        </div>
      </div>

      <div class="roster-member-groups">
        <span>Current Groups</span>
        <div class="roster-current-groups">
          ${memberGroups.length ? memberGroups.map(group => `
            <strong class="roster-current-group-tag">${window.RipCityUI.text(group.name)}</strong>
          `).join("") : `<strong class="roster-current-group-tag muted">No groups</strong>`}
        </div>
        <button
          class="outline-btn small-inline-btn roster-change-groups-btn"
          type="button"
          data-toggle-group-editor
          data-member-profile-id="${window.RipCityUI.attr(member.memberProfileId)}"
        >
          Change Groups
        </button>
      </div>

      <div class="roster-group-editor">
        <div class="roster-editor-heading">
          <span>Update Groups</span>
          <em class="roster-unsaved-indicator">Unsaved changes</em>
        </div>

        <div class="roster-group-checkboxes">
          ${compatibleGroups.length ? compatibleGroups.map(group => `
            <label class="roster-checkbox-pill">
              <input
                type="checkbox"
                data-roster-group-toggle
                data-member-profile-id="${window.RipCityUI.attr(member.memberProfileId)}"
                data-group-id="${window.RipCityUI.attr(group.id)}"
                ${groupIds.has(group.id) ? "checked" : ""}
              />
              <span>${window.RipCityUI.text(group.name)}</span>
            </label>
          `).join("") : `<span class="muted-small">No compatible groups yet.</span>`}
        </div>

        <div class="roster-member-actions">
          <button
            class="primary-btn small-inline-btn"
            type="button"
            data-save-member-groups
            data-member-profile-id="${window.RipCityUI.attr(member.memberProfileId)}"
            disabled
          >
            Save Groups
          </button>
          <button
            class="outline-btn small-inline-btn"
            type="button"
            data-reset-member-groups
            data-member-profile-id="${window.RipCityUI.attr(member.memberProfileId)}"
            disabled
          >
            Reset
          </button>
          <button
            class="danger-btn small-inline-btn"
            type="button"
            data-member-status-action
            data-facility-member-id="${window.RipCityUI.attr(member.facilityMemberId)}"
            data-next-status="${window.RipCityUI.attr(nextStatus)}"
          >
            ${statusActionLabel}
          </button>
        </div>
      </div>
    </article>
  `;
}

async function saveMemberGroupChanges(memberProfileId) {
  const card = document.querySelector(`[data-roster-member-card="${memberProfileId}"]`);
  const saveButton = card?.querySelector("[data-save-member-groups]");
  const savedGroupIds = getMemberGroupIds(memberProfileId);
  const selectedGroupIds = getCheckedGroupIds(memberProfileId);
  const selectedSet = new Set(selectedGroupIds);
  const savedSet = new Set(savedGroupIds);
  const groupsToAdd = selectedGroupIds.filter(groupId => !savedSet.has(groupId));
  const groupsToRemove = savedGroupIds.filter(groupId => !selectedSet.has(groupId));

  if (!groupsToAdd.length && !groupsToRemove.length) {
    markMemberGroupChanges(memberProfileId);
    return;
  }

  if (saveButton) saveButton.disabled = true;
  showRosterMessage("Saving group changes...");

  try {
    if (groupsToAdd.length) {
      const { error } = await db
        .from("group_members")
        .upsert(groupsToAdd.map(groupId => ({
          group_id: groupId,
          member_profile_id: memberProfileId
        })), {
          onConflict: "group_id,member_profile_id",
          ignoreDuplicates: true
        });

      if (error) throw error;
    }

    for (const groupId of groupsToRemove) {
      const { error } = await db
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("member_profile_id", memberProfileId);

      if (error) throw error;
    }

    rosterGroupMemberships = await loadRosterGroupMemberships(
      rosterMembers.map(member => member.memberProfileId)
    );

    renderGroupList();
    renderRosterMembers();
    showRosterMessage("Group changes saved.");
  } catch (error) {
    console.error(error);
    renderRosterMembers();
    showRosterMessage(error.message || "Could not save group changes.", true);
  }
}

async function deleteRosterGroup(groupId) {
  const group = rosterGroups.find(item => item.id === groupId);
  if (!group) return;

  const memberCount = rosterGroupMemberships.filter(row => row.group_id === groupId).length;

  showRosterMessage("Checking group before delete...");

  try {
    const { data: assignments, error: assignmentError } = await db
      .from("workout_assignments")
      .select("id")
      .eq("target_group_id", groupId)
      .limit(1);

    if (assignmentError) throw assignmentError;

    // Group-targeted assignments cascade on delete, so block deletion when
    // workout history still points at this group.
    if ((assignments || []).length) {
      showRosterMessage("This group has workout assignments. Remove or reassign those workouts before deleting the group.", true);
      return;
    }

    const confirmText = memberCount
      ? `Delete ${group.name}? This removes ${memberCount} member group assignment${memberCount === 1 ? "" : "s"}.`
      : `Delete ${group.name}?`;

    if (!confirm(confirmText)) {
      showRosterMessage("");
      return;
    }

    const { error } = await db
      .from("groups")
      .delete()
      .eq("id", groupId)
      .eq("facility_id", rosterAccess.membership.facility_id);

    if (error) throw error;

    await refreshRoster();
    showRosterMessage("Group deleted.");
  } catch (error) {
    console.error(error);
    showRosterMessage(error.message || "Could not delete group.", true);
  }
}

async function setRosterMemberStatus(facilityMemberId, nextStatus) {
  const member = rosterMembers.find(item => item.facilityMemberId === facilityMemberId);
  if (!member) return;

  const action = nextStatus === "inactive" ? "deactivate" : "reactivate";
  const confirmText = nextStatus === "inactive"
    ? `Deactivate ${member.name}? They will keep their history, but they will not have approved member access.`
    : `Reactivate ${member.name}? They will regain approved member access.`;

  if (!confirm(confirmText)) return;

  showRosterMessage(`${action === "deactivate" ? "Deactivating" : "Reactivating"} member...`);

  try {
    const { error } = await db
      .from("facility_members")
      .update({ status: nextStatus })
      .eq("id", facilityMemberId)
      .eq("facility_id", rosterAccess.membership.facility_id);

    if (error) throw error;

    await refreshRoster();
    showRosterMessage(nextStatus === "inactive" ? "Member deactivated." : "Member reactivated.");
  } catch (error) {
    console.error(error);
    showRosterMessage(error.message || "Could not update member status.", true);
  }
}

async function createRosterGroup(event) {
  event.preventDefault();

  const name = document.getElementById("new-group-name").value.trim();
  const groupType = document.getElementById("new-group-type").value;
  const memberType = document.getElementById("new-group-member-type").value;

  if (!name) {
    showRosterMessage("Group name is required.", true);
    return;
  }

  showRosterMessage("Creating group...");

  try {
    const { error } = await db
      .from("groups")
      .insert({
        facility_id: rosterAccess.membership.facility_id,
        name,
        group_type: groupType,
        member_type: memberType
      });

    if (error) throw error;

    document.getElementById("create-group-form").reset();
    await refreshRoster();
    showRosterMessage("Group created.");
  } catch (error) {
    console.error(error);
    showRosterMessage(error.message || "Could not create group.", true);
  }
}

async function refreshRoster() {
  if (!rosterAccess) return;

  showRosterMessage("Loading roster...");

  try {
    const facilityId = rosterAccess.membership.facility_id;

    rosterGroups = await loadRosterGroups(facilityId);
    rosterMembers = await loadRosterMembers(facilityId);
    rosterGroupMemberships = await loadRosterGroupMemberships(
      rosterMembers.map(member => member.memberProfileId)
    );

    renderGroupFilter();
    renderGroupList();
    renderRosterMembers();
    showRosterMessage("");
  } catch (error) {
    console.error(error);
    showRosterMessage(error.message || "Could not load roster.", true);
  }
}

async function logoutCoachRoster() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initCoachRosterPage() {
  showRosterMessage("Checking access...");

  try {
    rosterAccess = await requireRosterCoachAccess();
    if (!rosterAccess) return;

    await refreshRoster();
  } catch (error) {
    console.error(error);
    showRosterMessage(error.message || "Could not load roster page.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachRosterPage();

  document.getElementById("refresh-roster-btn").addEventListener("click", refreshRoster);
  document.getElementById("create-group-form").addEventListener("submit", createRosterGroup);
  document.getElementById("coach-roster-logout-btn").addEventListener("click", logoutCoachRoster);

  ["roster-type-filter", "roster-status-filter", "roster-group-filter", "roster-search"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderRosterMembers);
  });
});
