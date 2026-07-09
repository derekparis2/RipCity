const RIP_CITY_SLUG = "rip-city";

function getCurrentPage() {
  return window.location.pathname.split("/").pop();
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function getRipCityFacility() {
  const { data, error } = await db
    .from("facilities")
    .select("id, name, slug")
    .eq("slug", RIP_CITY_SLUG)
    .single();

  if (error) throw error;
  return data;
}

async function getCurrentUserProfile(userId) {
    const { data, error } = await db
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        global_role,
        facility_members:facility_members!facility_members_profile_id_fkey (
          id,
          role,
          status,
          facility_id
        )
      `)
      .eq("id", userId)
      .single();
  
    if (error) throw error;
    return data;
}

async function handleSignup(event) {
  event.preventDefault();

  showMessage("signup-message", "Creating your account...");

  const fullName = document.getElementById("signup-full-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const memberType = document.querySelector("input[name='member-type']:checked").value;

  const ageGroup = document.getElementById("signup-age-group").value;
  const sport = document.getElementById("signup-sport").value.trim();
  const position = document.getElementById("signup-position").value.trim();
  const school = document.getElementById("signup-school").value.trim();
  const graduationYear = document.getElementById("signup-grad-year").value;
  const bodyWeight = document.getElementById("signup-body-weight").value;

  try {
    const facility = await getRipCityFacility();

    const { data: authData, error: authError } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authError) throw authError;

    const user = authData.user;

    if (!user) {
      showMessage(
        "signup-message",
        "Account created. Check your email to confirm your account, then log in.",
        false
      );
      return;
    }

    const { error: profileError } = await db
      .from("profiles")
      .insert({
        id: user.id,
        email,
        full_name: fullName,
        global_role: "member"
      });

    if (profileError) throw profileError;

    const role = memberType === "athlete" ? "athlete" : "h2k_member";

    const { data: facilityMember, error: memberError } = await db
      .from("facility_members")
      .insert({
        facility_id: facility.id,
        profile_id: user.id,
        role,
        status: "pending"
      })
      .select("id")
      .single();

    if (memberError) throw memberError;

    const { error: memberProfileError } = await db
      .from("member_profiles")
      .insert({
        facility_member_id: facilityMember.id,
        member_type: memberType,
        sport: memberType === "athlete" ? sport || null : null,
        age_group: ageGroup || null,
        position: memberType === "athlete" ? position || null : null,
        school: memberType === "athlete" ? school || null : null,
        graduation_year: graduationYear ? Number(graduationYear) : null,
        body_weight: bodyWeight ? Number(bodyWeight) : null
      });

    if (memberProfileError) throw memberProfileError;

    window.location.href = "pending.html";
  } catch (error) {
    console.error(error);
    showMessage("signup-message", error.message || "Something went wrong while creating your account.", true);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  showMessage("login-message", "Logging in...");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const profile = await getCurrentUserProfile(data.user.id);
    const membership = profile.facility_members?.[0] || profile["facility_members!facility_members_profile_id_fkey"]?.[0];
    
    if (!membership || membership.status !== "approved") {
      window.location.href = "pending.html";
      return;
    }

    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
    showMessage("login-message", error.message || "Login failed.", true);
  }
}

async function handlePendingLogout() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

function setupMemberTypeToggle() {
  const memberTypeInputs = document.querySelectorAll("input[name='member-type']");
  const athleteFields = document.querySelectorAll(".athlete-only");

  function updateFields() {
    const selected = document.querySelector("input[name='member-type']:checked").value;

    athleteFields.forEach(field => {
      field.classList.toggle("hidden", selected !== "athlete");
    });
  }

  memberTypeInputs.forEach(input => {
    input.addEventListener("change", updateFields);
  });

  updateFields();
}

async function getCurrentSession() {
    const { data, error } = await db.auth.getSession();
  
    if (error) throw error;
  
    return data.session;
}
  
async function requireCoachOrAdmin() {
    const session = await getCurrentSession();
  
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
  
    const profile = await getCurrentUserProfile(session.user.id);
    const membership = profile.facility_members?.[0] || profile["facility_members!facility_members_profile_id_fkey"]?.[0];

    if (!membership || membership.status !== "approved") {
      window.location.href = "pending.html";
      return null;
    }
  
    if (membership.role !== "coach" && membership.role !== "admin") {
      showMessage("approval-message", "You do not have permission to view this page.", true);
      return null;
    }
  
    return {
      session,
      profile,
      membership
    };
}
  
async function loadPendingUsers() {
    const access = await requireCoachOrAdmin();
    if (!access) return;
  
    showMessage("approval-message", "Loading pending users...");
  
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
  
      console.log("Pending users:", data);
  
      renderPendingUsers(data || []);
      showMessage("approval-message", "");
    } catch (error) {
      console.error(error);
      showMessage("approval-message", error.message || "Could not load pending users.", true);
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
              <span>${formatRole(user.role)}</span>
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
  
function formatRole(role) {
    if (role === "h2k_member") return "H2K Member";
    if (role === "athlete") return "Athlete";
    if (role === "coach") return "Coach";
    if (role === "admin") return "Admin";
    if (role === "parent") return "Parent";
    return role;
}
  
async function updateApprovalStatus(facilityMemberId, status) {
    const access = await requireCoachOrAdmin();
    if (!access) return;
  
    const confirmText = status === "approved"
      ? "Approve this user?"
      : "Reject this user?";
  
    const shouldContinue = confirm(confirmText);
    if (!shouldContinue) return;
  
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
        .eq("id", facilityMemberId);
  
      if (error) throw error;
  
      await loadPendingUsers();
    } catch (error) {
      console.error(error);
      showMessage("approval-message", error.message || "Could not update user status.", true);
    }
}
  
async function handleApprovalLogout() {
    await db.auth.signOut();
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = getCurrentPage();

  if (currentPage === "signup.html") {
    setupMemberTypeToggle();
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
  }

  if (currentPage === "login.html") {
    document.getElementById("login-form").addEventListener("submit", handleLogin);
  }

  if (currentPage === "pending.html") {
    document.getElementById("pending-logout-btn").addEventListener("click", handlePendingLogout);
  }

  if (currentPage === "coach-approvals.html") {
    loadPendingUsers();
  
    document.getElementById("refresh-approvals-btn").addEventListener("click", loadPendingUsers);
    document.getElementById("approval-logout-btn").addEventListener("click", handleApprovalLogout);
  }
});