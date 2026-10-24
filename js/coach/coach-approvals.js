// =====================================================
// COACH APPROVALS PAGE
// =====================================================
// Coaches can review pending signups, but only facility admins can approve or
// reject them. New signups stay pending until an admin makes that decision.

let approvalAccess = null;
let approvalMemberGroups = [];

function showApprovalMessage(message, isError = false) {
  const element = document.getElementById("approval-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function showCoachInviteMessage(message, isError = false) {
  const element = document.getElementById("coach-invite-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function showCoachManagementMessage(message, isError = false) {
  const element = document.getElementById("coach-management-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function getApprovalSession() {
  return window.RipCityAccess.getSession();
}

async function getApprovalUserProfile(userId) {
  return window.RipCityAccess.getProfileWithMemberships(userId);
}

async function requireApprovalCoachOrAdmin() {
  return window.RipCityAccess.requireCoachAccess({
    onDeniedMessage: showApprovalMessage
  });
}

function formatApprovalRole(role) {
  const labels = {
    h2k_member: "H2K Member",
    athlete: "Athlete",
    coach: "Coach",
    admin: "Admin",
    parent: "Parent"
  };

  return labels[role] || role;
}

function getApprovalMemberProfile(user) {
  if (Array.isArray(user.member_profile)) return user.member_profile[0] || null;
  return user.member_profile || null;
}

function getApprovalGroupsForMemberType(memberType) {
  return approvalMemberGroups.filter(group => (
    group.member_type === memberType || group.member_type === "both"
  ));
}

function renderApprovalGroupOptions(memberType) {
  const matchingGroups = getApprovalGroupsForMemberType(memberType);
  const groupLabel = memberType === "h2k" ? "H2K" : "athlete";

  if (!matchingGroups.length) {
    return `<option value="">No ${groupLabel} groups available — create one in Roster</option>`;
  }

  return `
    <option value="">Select training group</option>
    ${matchingGroups.map(group => `
      <option value="${window.RipCityUI.attr(group.id)}">${window.RipCityUI.text(group.name)}</option>
    `).join("")}
  `;
}

async function loadPendingUsers() {
  const access = await requireApprovalCoachOrAdmin();
  if (!access) return;

  approvalAccess = access;
  document.getElementById("coach-invite-panel")?.classList.toggle("hidden", !access.isAdmin);
  document.getElementById("coach-management-panel")?.classList.toggle("hidden", !access.isAdmin);

  const accessNote = document.getElementById("approval-access-note");
  if (accessNote) {
    accessNote.textContent = access.isAdmin
      ? "Approve or reject new users before they can access the app."
      : "Review pending signups here. A facility admin must approve, reject, deactivate, or reactivate an account.";
  }

  showApprovalMessage("Loading pending users...");

  try {
    const [pendingResult, groupsResult] = await Promise.all([
      db
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
            member_type
          )
        `)
        .eq("facility_id", access.membership.facility_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      db
        .from("groups")
        .select("id, name, member_type")
        .eq("facility_id", access.membership.facility_id)
        .in("member_type", ["athlete", "h2k", "both"])
        .order("name", { ascending: true })
    ]);

    if (pendingResult.error) throw pendingResult.error;
    if (groupsResult.error) throw groupsResult.error;

    approvalMemberGroups = groupsResult.data || [];

    renderPendingUsers(pendingResult.data || [], access);
    showApprovalMessage("");

    if (access.isAdmin) {
      await loadCoachStaff(access);
    }
  } catch (error) {
    console.error(error);
    showApprovalMessage(error.message || "Could not load pending users.", true);
  }
}

async function loadCoachStaff(access = approvalAccess) {
  if (!access?.isAdmin) return;

  showCoachManagementMessage("Loading coaches...");

  try {
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
        )
      `)
      .eq("facility_id", access.membership.facility_id)
      .eq("role", "coach")
      .in("status", ["approved", "inactive"])
      .order("created_at", { ascending: true });

    if (error) throw error;

    renderCoachStaff(data || []);
    showCoachManagementMessage("");
  } catch (error) {
    console.error(error);
    showCoachManagementMessage(error.message || "Could not load coach access.", true);
  }
}

function renderCoachStaff(coaches) {
  const list = document.getElementById("coach-management-list");
  if (!list) return;

  if (!coaches.length) {
    list.innerHTML = `<div class="empty-state">No approved or inactive coaches yet.</div>`;
    return;
  }

  list.innerHTML = coaches.map(coach => {
    const profile = coach.profile;
    const isInactive = coach.status === "inactive";
    const nextStatus = isInactive ? "approved" : "inactive";
    const actionLabel = isInactive ? "Reactivate" : "Deactivate";

    return `
      <article class="pending-user-card coach-management-card${isInactive ? " is-inactive" : ""}">
        <div>
          <h4>${window.RipCityUI.text(profile?.full_name, "Unnamed Coach")}</h4>
          <div class="pending-user-meta">
            <span>${window.RipCityUI.text(profile?.email, "No email")}</span>
            <span>Coach</span>
            <span>Status: ${window.RipCityUI.text(coach.status)}</span>
          </div>
        </div>
        <div class="pending-user-actions">
          <button
            class="${isInactive ? "approve-btn" : "reject-btn"}"
            type="button"
            data-coach-status-action="${window.RipCityUI.attr(coach.id)}"
            data-next-status="${window.RipCityUI.attr(nextStatus)}"
            data-coach-name="${window.RipCityUI.attr(profile?.full_name || "this coach")}">
            ${actionLabel}
          </button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-coach-status-action]").forEach(button => {
    button.addEventListener("click", () => updateCoachStatus(
      button.dataset.coachStatusAction,
      button.dataset.nextStatus,
      button.dataset.coachName
    ));
  });
}

async function updateCoachStatus(facilityMemberId, nextStatus, coachName) {
  const access = approvalAccess || await requireApprovalCoachOrAdmin();
  if (!access?.isAdmin) {
    showCoachManagementMessage("Only a facility administrator can manage coach access.", true);
    return;
  }

  const action = nextStatus === "inactive" ? "deactivate" : "reactivate";
  const detail = nextStatus === "inactive"
    ? "They will lose coaching access, but their account and history will remain stored."
    : "They will regain coaching access with their existing account and history.";

  if (!confirm(`${action === "deactivate" ? "Deactivate" : "Reactivate"} ${coachName}? ${detail}`)) return;

  showCoachManagementMessage(`${action === "deactivate" ? "Deactivating" : "Reactivating"} coach...`);

  try {
    const { data, error } = await db
      .from("facility_members")
      .update({ status: nextStatus })
      .eq("id", facilityMemberId)
      .eq("facility_id", access.membership.facility_id)
      .eq("role", "coach")
      .select("id, status")
      .single();

    if (error) throw error;
    if (data.status !== nextStatus) throw new Error("Coach access did not update as expected.");

    await loadCoachStaff(access);
    showCoachManagementMessage(nextStatus === "inactive" ? "Coach deactivated." : "Coach reactivated.");
  } catch (error) {
    console.error(error);
    showCoachManagementMessage(error.message || "Could not update coach access.", true);
  }
}

function renderPendingUsers(users, access) {
  const list = document.getElementById("pending-users-list");

  if (!users.length) {
    list.innerHTML = `<div class="empty-state">No pending users right now.</div>`;
    return;
  }

  list.innerHTML = users.map(user => {
    const profile = user.profile;
    const memberProfile = getApprovalMemberProfile(user);
    const isElevatedRequest = user.role === "coach" || user.role === "admin";
    const isGroupedMember = (
      (user.role === "athlete" && memberProfile?.member_type === "athlete")
      || (user.role === "h2k_member" && memberProfile?.member_type === "h2k")
    );
    const canDecide = access.isAdmin;

    return `
      <article class="pending-user-card${isElevatedRequest ? " elevated-request" : ""}">
        <div>
          <h4>${window.RipCityUI.text(profile?.full_name, "Unnamed User")}</h4>
          <div class="pending-user-meta">
            <span>${window.RipCityUI.text(profile?.email, "No email")}</span>
            <span>${window.RipCityUI.text(formatApprovalRole(user.role))}</span>
            <span>Status: ${window.RipCityUI.text(user.status)}</span>
            ${!canDecide ? "<span>Facility-admin action required</span>" : ""}
          </div>
          ${canDecide && isGroupedMember ? `
            <label class="pending-user-group-control" for="approval-group-${window.RipCityUI.attr(user.id)}">
              <span>Initial ${memberProfile.member_type === "h2k" ? "H2K" : "training"} group</span>
              <select id="approval-group-${window.RipCityUI.attr(user.id)}" data-approval-group="${window.RipCityUI.attr(user.id)}">
                ${renderApprovalGroupOptions(memberProfile.member_type)}
              </select>
            </label>
          ` : ""}
        </div>

        <div class="pending-user-actions">
          ${canDecide ? `
            <button class="approve-btn" data-approve-user="${window.RipCityUI.attr(user.id)}" data-approval-role="${window.RipCityUI.attr(user.role)}"${isGroupedMember ? " disabled" : ""}>Approve</button>
            <button class="reject-btn" data-reject-user="${window.RipCityUI.attr(user.id)}" data-approval-role="${window.RipCityUI.attr(user.role)}">Reject</button>
          ` : "<span>Waiting for a facility admin</span>"}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-approve-user]").forEach(button => {
    button.addEventListener("click", () => updateApprovalStatus(
      button.dataset.approveUser,
      "approved",
      button.dataset.approvalRole
    ));
  });

  document.querySelectorAll("[data-approval-group]").forEach(select => {
    select.addEventListener("change", () => {
      const button = document.querySelector(`[data-approve-user="${select.dataset.approvalGroup}"]`);
      if (button) button.disabled = !select.value;
    });
  });

  document.querySelectorAll("[data-reject-user]").forEach(button => {
    button.addEventListener("click", () => updateApprovalStatus(
      button.dataset.rejectUser,
      "rejected",
      button.dataset.approvalRole
    ));
  });
}

async function updateApprovalStatus(facilityMemberId, status, role) {
  const access = await requireApprovalCoachOrAdmin();
  if (!access) return;
  if (!access.isAdmin) {
    showApprovalMessage("Only a facility administrator can approve or reject member access.", true);
    return;
  }

  const isElevatedRequest = role === "coach" || role === "admin";
  const isGroupedMemberApproval = status === "approved" && ["athlete", "h2k_member"].includes(role);
  const selectedGroupId = isGroupedMemberApproval
    ? document.querySelector(`[data-approval-group="${facilityMemberId}"]`)?.value || ""
    : "";

  if (isGroupedMemberApproval && !selectedGroupId) {
    showApprovalMessage("Choose an initial group before approving this member.", true);
    return;
  }
  const confirmText = status === "approved" && isElevatedRequest
    ? `Approve this ${formatApprovalRole(role).toLowerCase()}? This grants access to facility coaching tools.`
    : status === "approved"
      ? "Approve this user?"
      : `Reject this ${isElevatedRequest ? formatApprovalRole(role).toLowerCase() : "user"}?`;

  if (!confirm(confirmText)) return;

  try {
    if (isGroupedMemberApproval) {
      const { data, error } = await db.rpc("approve_pending_member", {
        pending_facility_member_id: facilityMemberId,
        initial_group_id: selectedGroupId
      });

      if (error) throw error;
      if (!data?.length || data[0].status !== "approved") {
        throw new Error("The member was not approved as expected.");
      }

      await loadPendingUsers();
      return;
    }

    const updateData = {
      status
    };

    if (status === "approved") {
      updateData.approved_by = access.profile.id;
      updateData.approved_at = new Date().toISOString();
    }

    const { error } = await db
      .from("facility_members")
      .update(updateData)
      .eq("id", facilityMemberId)
      .eq("facility_id", access.membership.facility_id);

    if (error) throw error;

    await loadPendingUsers();
  } catch (error) {
    console.error(error);
    showApprovalMessage(error.message || "Could not update user status.", true);
  }
}

function buildCoachInviteUrl(inviteCode) {
  const url = new URL("signup.html", window.location.href);
  url.searchParams.set("coach_invite", inviteCode);
  return url.href;
}

async function copyCoachInviteText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();

  if (!copied) throw new Error("Copy failed.");
}

async function createCoachInvite() {
  const access = approvalAccess || await requireApprovalCoachOrAdmin();
  if (!access?.isAdmin) {
    showCoachInviteMessage("Only a facility administrator can create coach links.", true);
    return;
  }

  const button = document.getElementById("create-coach-invite-btn");
  button.disabled = true;
  showCoachInviteMessage("Creating a secure coach link...");

  try {
    const { data, error } = await db.rpc("create_coach_invite", {
      invite_facility_id: access.membership.facility_id
    });

    if (error) throw error;
    if (!data?.length) throw new Error("The coach invite could not be created.");

    const inviteUrl = buildCoachInviteUrl(data[0].invite_code);

    try {
      await copyCoachInviteText(inviteUrl);
      showCoachInviteMessage("Coach signup link copied. It can be used once and expires in seven days.");
    } catch (copyError) {
      console.error(copyError);
      showCoachInviteMessage(`Copy this coach signup link: ${inviteUrl}`, true);
    }
  } catch (error) {
    console.error(error);
    showCoachInviteMessage(error.message || "Could not create the coach signup link.", true);
  } finally {
    button.disabled = false;
  }
}

async function handleApprovalLogout() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  loadPendingUsers();

  document.getElementById("refresh-approvals-btn").addEventListener("click", loadPendingUsers);
  document.getElementById("create-coach-invite-btn").addEventListener("click", createCoachInvite);
  document.getElementById("approval-logout-btn").addEventListener("click", handleApprovalLogout);
});
