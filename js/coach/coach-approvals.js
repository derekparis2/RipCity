// =====================================================
// COACH APPROVALS PAGE
// =====================================================
// Coaches/admins use this page to approve or reject new members.
// New signups stay in facility_members.status = "pending" until approved.

let approvalAccess = null;

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

async function loadPendingUsers() {
  const access = await requireApprovalCoachOrAdmin();
  if (!access) return;

  approvalAccess = access;
  document.getElementById("coach-invite-panel")?.classList.toggle("hidden", !access.isAdmin);
  document.getElementById("coach-management-panel")?.classList.toggle("hidden", !access.isAdmin);

  showApprovalMessage("Loading pending users...");

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
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderPendingUsers(data || [], access);
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
    const isElevatedRequest = user.role === "coach" || user.role === "admin";
    const canDecide = !isElevatedRequest || access.isAdmin;

    return `
      <article class="pending-user-card${isElevatedRequest ? " elevated-request" : ""}">
        <div>
          <h4>${window.RipCityUI.text(profile?.full_name, "Unnamed User")}</h4>
          <div class="pending-user-meta">
            <span>${window.RipCityUI.text(profile?.email, "No email")}</span>
            <span>${window.RipCityUI.text(formatApprovalRole(user.role))}</span>
            <span>Status: ${window.RipCityUI.text(user.status)}</span>
            ${isElevatedRequest ? "<span>Facility-admin approval required</span>" : ""}
          </div>
        </div>

        <div class="pending-user-actions">
          ${canDecide ? `
            <button class="approve-btn" data-approve-user="${window.RipCityUI.attr(user.id)}" data-approval-role="${window.RipCityUI.attr(user.role)}">Approve</button>
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

  const isElevatedRequest = role === "coach" || role === "admin";
  const confirmText = status === "approved" && isElevatedRequest
    ? `Approve this ${formatApprovalRole(role).toLowerCase()}? This grants access to facility coaching tools.`
    : status === "approved"
      ? "Approve this user?"
      : `Reject this ${isElevatedRequest ? formatApprovalRole(role).toLowerCase() : "user"}?`;

  if (!confirm(confirmText)) return;

  try {
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

function createCoachInviteCode() {
  if (!window.crypto?.randomUUID) {
    throw new Error("This browser cannot create a secure coach invite. Try an updated browser.");
  }

  return `${window.crypto.randomUUID()}${window.crypto.randomUUID()}`.replaceAll("-", "");
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
    const inviteCode = createCoachInviteCode();
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await db
      .from("facility_invites")
      .insert({
        facility_id: access.membership.facility_id,
        created_by: access.profile.id,
        invite_code: inviteCode,
        default_role: "coach",
        default_member_type: null,
        default_group_id: null,
        active: true,
        expires_at: expiresAt
      })
      .select("invite_code")
      .single();

    if (error) throw error;

    const inviteUrl = buildCoachInviteUrl(data.invite_code);

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
