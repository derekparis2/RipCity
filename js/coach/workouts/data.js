// =====================================================
// COACH WORKOUT PAGE STATE AND FACILITY DATA
// =====================================================
// Holds the page's shared state and the facility-scoped reads used by builder,
// assignment, library, and history modules.

let workoutCoachAccess = null;
let availableGroups = [];
let availableMembers = [];
let availableGroupMemberships = [];
let exerciseTemplates = [];
let exerciseLibraryAvailable = false;
let recentWorkoutRows = [];

async function requireCoachOrAdmin() {
  return window.RipCityAccess.requireCoachAccess({
    onDeniedMessage: showWorkoutMessage
  });
}

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

function getFilteredGroups() {
  return availableGroups;
}

function getFilteredMembers() {
  return availableMembers;
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

function renderGroupOptions() {
  const groupList = document.getElementById("workout-group");
  const groups = getFilteredGroups();
  if (!groupList) return;

  if (!groups.length) {
    groupList.innerHTML = `<div class="muted-small">No compatible groups found</div>`;
    return;
  }

  const selectedIds = new Set(getSelectedValues("workout-group"));

  groupList.dataset.checkboxList = "true";
  groupList.innerHTML = `
    ${groups.map(group => `
      <label class="assignment-checkbox-chip">
        <span>
          <strong>${window.RipCityUI.text(group.name)}</strong>
          <small>${window.RipCityUI.text(group.member_type)}</small>
        </span>
        <input
          type="checkbox"
          value="${window.RipCityUI.attr(group.id)}"
          ${selectedIds.has(group.id) ? "checked" : ""}
        />
      </label>
    `).join("")}
  `;
}

function renderMemberOptions() {
  const select = document.getElementById("workout-member");
  if (!select) return;

  const members = getFilteredMembers();

  if (!members.length) {
    select.innerHTML = `<option value="">No compatible approved members found</option>`;
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
}
