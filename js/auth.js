const RIP_CITY_SLUG = "rip-city";
let signupFacility = null;
let signupGroups = [];

// This file is only for public auth pages:
// signup.html, login.html, and pending.html.
// Coach approval logic lives in coach-approvals.js.

function getCurrentPage() {
  return window.location.pathname.split("/").pop();
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function escapeOptionText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function createClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, char => (
    Number(char) ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4
  ).toString(16));
}

async function getRipCityFacility() {
  // Signup currently joins everyone to the seeded Rip City facility.
  // Later this can be invite-code driven for other facilities.
  const { data, error } = await db
    .from("facilities")
    .select("id, name, slug")
    .eq("slug", RIP_CITY_SLUG)
    .single();

  if (error) throw error;
  return data;
}

async function loadSignupGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("id, name, group_type, member_type")
    .eq("facility_id", facilityId)
    .in("member_type", ["athlete", "both"])
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

function renderSignupGroups(groups) {
  const select = document.getElementById("signup-training-group");
  if (!select) return;

  if (!groups.length) {
    select.innerHTML = `<option value="">No athlete groups available</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select training group</option>
    ${groups.map(group => `
      <option value="${group.id}">${escapeOptionText(group.name)}</option>
    `).join("")}
  `;
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
  const trainingGroupId = document.getElementById("signup-training-group")?.value || "";
  const sport = document.getElementById("signup-sport").value.trim();
  const position = document.getElementById("signup-position").value.trim();
  const school = document.getElementById("signup-school").value.trim();
  const graduationYear = document.getElementById("signup-grad-year").value;
  const bodyWeight = document.getElementById("signup-body-weight").value;

  try {
    const facility = signupFacility || await getRipCityFacility();

    if (memberType === "athlete" && !trainingGroupId) {
      showMessage("signup-message", "Choose a training group before creating your account.", true);
      return;
    }

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

    // facility_members controls approval/access for the facility.
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

    const memberProfileId = createClientId();

    // member_profiles stores program-specific member details.
    const { error: memberProfileError } = await db
      .from("member_profiles")
      .insert({
        id: memberProfileId,
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

    if (memberType === "athlete") {
      const { error: groupMemberError } = await db
        .from("group_members")
        .insert({
          group_id: trainingGroupId,
          member_profile_id: memberProfileId
        });

      if (groupMemberError) throw groupMemberError;
    }

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
    const membership =
      profile.facility_members?.[0] ||
      profile["facility_members!facility_members_profile_id_fkey"]?.[0];

    if (!membership || membership.status !== "approved") {
      window.location.href = "pending.html";
      return;
    }

    if (membership.role === "coach" || membership.role === "admin") {
      window.location.href = "coach-dashboard.html";
      return;
    }

    // Athletes and H2K members share the member dashboard. Program-specific
    // modules such as H2K habits are enabled from member profile data.
    if (membership.role === "h2k_member" || membership.role === "athlete") {
      window.location.href = "member-dashboard.html";
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

function updateSignupMemberTypeFields() {
  const selected = document.querySelector("input[name='member-type']:checked").value;
  const athleteFields = document.querySelectorAll(".athlete-only");
  const trainingGroup = document.getElementById("signup-training-group");

  athleteFields.forEach(field => {
    field.classList.toggle("hidden", selected !== "athlete");
  });

  if (trainingGroup) {
    trainingGroup.required = selected === "athlete";
    trainingGroup.disabled = selected !== "athlete";

    if (selected !== "athlete") {
      trainingGroup.value = "";
    }
  }
}

function setupMemberTypeToggle() {
  const memberTypeInputs = document.querySelectorAll("input[name='member-type']");

  memberTypeInputs.forEach(input => {
    input.addEventListener("change", updateSignupMemberTypeFields);
  });

  updateSignupMemberTypeFields();
}

async function setupSignupPage() {
  setupMemberTypeToggle();

  try {
    signupFacility = await getRipCityFacility();
    signupGroups = await loadSignupGroups(signupFacility.id);
    renderSignupGroups(signupGroups);
    updateSignupMemberTypeFields();
  } catch (error) {
    console.error(error);
    renderSignupGroups([]);
    showMessage("signup-message", "Could not load signup groups. Try refreshing the page.", true);
  }

  document.getElementById("signup-form").addEventListener("submit", handleSignup);
}

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = getCurrentPage();

  if (currentPage === "signup.html") {
    setupSignupPage();
  }

  if (currentPage === "login.html") {
    document.getElementById("login-form").addEventListener("submit", handleLogin);
  }

  if (currentPage === "pending.html") {
    document.getElementById("pending-logout-btn").addEventListener("click", handlePendingLogout);
  }
});
