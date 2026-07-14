const RIP_CITY_SLUG = "rip-city";

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

    // member_profiles stores program-specific member details.
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

    // H2K members go directly to the H2K habit dashboard.
    if (membership.role === "h2k_member") {
      window.location.href = "member-dashboard.html";
      return;
    }

    // Athletes go to the main app for now.
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
});
