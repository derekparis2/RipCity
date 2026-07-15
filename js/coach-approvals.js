// =====================================================
// COACH APPROVALS PAGE
// =====================================================
// Coaches/admins use this page to approve or reject new members.
// New signups stay in facility_members.status = "pending" until approved.

function showApprovalMessage(message, isError = false) {
  const element = document.getElementById("approval-message");
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

    renderPendingUsers(data || []);
    showApprovalMessage("");
  } catch (error) {
    console.error(error);
    showApprovalMessage(error.message || "Could not load pending users.", true);
  }
}

function renderPendingUsers(users) {
  const list = document.getElementById("pending-users-list");

  if (!users.length) {
    list.innerHTML = `<div class="empty-state">No pending users right now.</div>`;
    return;
  }

  list.innerHTML = users.map(user => {
    const profile = user.profile;

    return `
      <article class="pending-user-card">
        <div>
          <h4>${profile?.full_name || "Unnamed User"}</h4>
          <div class="pending-user-meta">
            <span>${profile?.email || "No email"}</span>
            <span>${formatApprovalRole(user.role)}</span>
            <span>Status: ${user.status}</span>
          </div>
        </div>

        <div class="pending-user-actions">
          <button class="approve-btn" data-approve-user="${user.id}">Approve</button>
          <button class="reject-btn" data-reject-user="${user.id}">Reject</button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-approve-user]").forEach(button => {
    button.addEventListener("click", () => updateApprovalStatus(button.dataset.approveUser, "approved"));
  });

  document.querySelectorAll("[data-reject-user]").forEach(button => {
    button.addEventListener("click", () => updateApprovalStatus(button.dataset.rejectUser, "rejected"));
  });
}

async function updateApprovalStatus(facilityMemberId, status) {
  const access = await requireApprovalCoachOrAdmin();
  if (!access) return;

  const confirmText = status === "approved"
    ? "Approve this user?"
    : "Reject this user?";

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

async function handleApprovalLogout() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  loadPendingUsers();

  document.getElementById("refresh-approvals-btn").addEventListener("click", loadPendingUsers);
  document.getElementById("approval-logout-btn").addEventListener("click", handleApprovalLogout);
});
